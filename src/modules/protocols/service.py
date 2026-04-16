"""Сервис обработки протоколов совещаний.

Основной бизнес-логики модуля: STT (faster-whisper / Yandex SpeechKit),
диаризация (pyannote.audio), генерация протокола (LLM),
извлечение action items, анализ тональности.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import structlog
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings, STTProvider
from src.core.onec_connector import OneCConnector
from src.core.rag import RAGService
from src.core.security import encrypt_data, encrypt_file, decrypt_file
from src.modules.protocols.models import ProtocolStatus
from src.modules.protocols.repository import ProtocolRepository
from src.modules.protocols.schemas import (
    ActionItemSchema,
    MeetingProtocolSchema,
    SpeakerSegmentSchema,
    ToneAnalysisSchema,
)

logger = structlog.get_logger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"

_jinja_env = Environment(
    loader=FileSystemLoader(str(PROMPTS_DIR)),
    autoescape=False,
)


class ProtocolService:
    """Сервис обработки аудиозаписей совещаний.

    Реализует полный пайплайн:
    1. STT (распознавание речи)
    2. Диаризация (определение спикеров)
    3. Генерация структурированного протокола (LLM)
    4. Извлечение action items
    5. Анализ tone-of-voice
    6. Сохранение результатов
    7. Создание задач в 1С
    8. Уведомления

    Args:
        session: асинхронная сессия SQLAlchemy.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.repository = ProtocolRepository(session)
        self.rag_service = RAGService()
        self.onec_connector = OneCConnector()

    async def process_audio(
        self,
        protocol_id: int,
        encrypted_file_path: str,
    ) -> None:
        """Полный пайплайн обработки аудиозаписи совещания.

        Основная точка входа для Celery task. Выполняет все этапы
        обработки последовательно и сохраняет результаты в БД.

        Args:
            protocol_id: идентификатор протокола в БД.
            encrypted_file_path: путь к зашифрованному аудиофайлу.
        """
        logger.info(
            "Начало обработки аудио",
            protocol_id=protocol_id,
        )

        try:
            await self.repository.update_protocol_status(
                protocol_id, ProtocolStatus.PROCESSING
            )
            protocol = await self.repository.get_protocol_by_id(protocol_id)
            if not protocol:
                raise ValueError(f"Протокол {protocol_id} не найден")

            # === Этап 1: STT + Диаризация ===
            await self.repository.update_protocol_status(
                protocol_id, ProtocolStatus.TRANSCRIBING
            )
            segments = await self._transcribe_and_diarize(
                encrypted_file_path
            )
            logger.info(
                "Транскрипция завершена",
                protocol_id=protocol_id,
                segments_count=len(segments),
            )

            # === Этап 2: Генерация протокола (LLM) ===
            await self.repository.update_protocol_status(
                protocol_id, ProtocolStatus.GENERATING
            )

            full_transcript = "\n".join(
                f"[{s.speaker}]: {s.text}" for s in segments
            )

            protocol_data = await self._generate_protocol(
                title=protocol.title,
                meeting_date=str(protocol.meeting_date),
                participants=protocol.participants or [],
                segments=segments,
            )
            logger.info(
                "Протокол сгенерирован",
                protocol_id=protocol_id,
                action_items_count=len(protocol_data.action_items),
            )

            # === Этап 3: Анализ тональности ===
            tone_data = await self._analyze_tone(
                transcript=full_transcript,
                participants=protocol.participants or [],
            )
            logger.info(
                "Анализ тональности завершён",
                protocol_id=protocol_id,
                score=tone_data.overall_score,
            )

            # === Этап 4: Сохранение результатов ===
            encrypted_transcript = encrypt_data(full_transcript)
            diarized_json = {
                "segments": [s.model_dump(mode="json") for s in segments]
            }
            protocol_text = self._format_protocol_text(protocol_data)

            await self.repository.save_protocol_results(
                protocol_id=protocol_id,
                transcript_encrypted=encrypted_transcript,
                diarized_transcript=diarized_json,
                protocol_text=protocol_text,
                agenda=protocol_data.agenda,
                decisions=protocol_data.decisions,
                duration_seconds=int(segments[-1].end_time) if segments else None,
            )

            # === Этап 5: Создание поручений ===
            action_items_data = [
                item.model_dump(mode="json")
                for item in protocol_data.action_items
            ]
            action_items = await self.repository.create_action_items(
                protocol_id=protocol_id,
                items=action_items_data,
            )

            # === Этап 6: Анализ тональности → БД ===
            await self.repository.save_tone_analysis(
                protocol_id=protocol_id,
                overall_score=tone_data.overall_score,
                is_compliant=tone_data.is_compliant,
                violations=[
                    v.model_dump(mode="json") for v in tone_data.violations
                ],
                recommendations=tone_data.recommendations,
                speaker_scores=tone_data.speaker_scores,
                positive_aspects=tone_data.positive_aspects,
            )

            # === Этап 7: Создание задач в 1С ===
            await self._create_onec_tasks(protocol_id, action_items_data)

            logger.info(
                "Обработка протокола завершена успешно",
                protocol_id=protocol_id,
            )

        except Exception as exc:
            logger.error(
                "Ошибка обработки протокола",
                protocol_id=protocol_id,
                error=str(exc),
                exc_info=True,
            )
            await self.repository.update_protocol_status(
                protocol_id,
                ProtocolStatus.FAILED,
                error_message=str(exc),
            )
            raise

    async def _transcribe_and_diarize(
        self,
        encrypted_file_path: str,
    ) -> list[SpeakerSegmentSchema]:
        """Распознать речь и определить спикеров.

        Расшифровывает аудиофайл во временную директорию,
        выполняет STT и диаризацию, затем удаляет временный файл.

        Args:
            encrypted_file_path: путь к зашифрованному аудиофайлу.

        Returns:
            Список сегментов транскрипта с метками спикеров.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_audio = Path(tmp_dir) / "audio.wav"
            decrypt_file(Path(encrypted_file_path), tmp_audio)

            raw_transcript = await self._run_stt(tmp_audio)
            diarization = await self._run_diarization(tmp_audio)
            segments = self._merge_transcript_with_diarization(
                raw_transcript, diarization
            )

        return segments

    async def _run_stt(
        self,
        audio_path: Path,
    ) -> list[dict]:
        """Выполнить Speech-to-Text.

        Выбирает провайдер (faster-whisper или Yandex SpeechKit)
        на основе настроек.

        Args:
            audio_path: путь к аудиофайлу.

        Returns:
            Список сегментов: [{"start": float, "end": float, "text": str}].
        """
        if settings.stt_provider == STTProvider.FASTER_WHISPER:
            return await self._stt_faster_whisper(audio_path)
        else:
            return await self._stt_yandex_speechkit(audio_path)

    async def _stt_faster_whisper(
        self,
        audio_path: Path,
    ) -> list[dict]:
        """STT через faster-whisper (локальная модель).

        Args:
            audio_path: путь к аудиофайлу.

        Returns:
            Список сегментов с таймкодами и текстом.
        """
        import asyncio

        from faster_whisper import WhisperModel

        def _transcribe() -> list[dict]:
            model = WhisperModel(
                settings.whisper_model_size,
                device="auto",
                compute_type="auto",
            )
            segments_iter, info = model.transcribe(
                str(audio_path),
                language="ru",
                vad_filter=True,
            )
            logger.info(
                "faster-whisper: распознавание",
                language=info.language,
                duration=f"{info.duration:.1f}с",
            )
            return [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip(),
                }
                for seg in segments_iter
            ]

        return await asyncio.to_thread(_transcribe)

    async def _stt_yandex_speechkit(
        self,
        audio_path: Path,
    ) -> list[dict]:
        """STT через Yandex SpeechKit API.

        Args:
            audio_path: путь к аудиофайлу.

        Returns:
            Список сегментов с таймкодами и текстом.
        """
        import httpx

        audio_data = audio_path.read_bytes()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize",
                headers={
                    "Authorization": f"Api-Key {settings.yandex_speechkit_api_key}",
                },
                params={
                    "lang": "ru-RU",
                    "folderId": settings.yandex_speechkit_folder_id,
                    "format": "lpcm",
                    "sampleRateHertz": 16000,
                },
                content=audio_data,
                timeout=120,
            )
            response.raise_for_status()
            result = response.json()

        logger.info("Yandex SpeechKit: распознавание завершено")
        return [
            {
                "start": 0.0,
                "end": 0.0,
                "text": result.get("result", ""),
            }
        ]

    async def _run_diarization(
        self,
        audio_path: Path,
    ) -> list[dict]:
        """Выполнить диаризацию через pyannote.audio.

        Определяет, кто и когда говорил на аудиозаписи.
        Если HF_TOKEN не задан, возвращает пустой список (fallback:
        все сегменты будут помечены как Speaker_1).

        Args:
            audio_path: путь к аудиофайлу.

        Returns:
            Список сегментов: [{"start": float, "end": float, "speaker": str}].
        """
        hf_token = settings.hf_token.strip()
        if not hf_token or hf_token == "your-huggingface-token":
            logger.warning(
                "HF_TOKEN не задан — диаризация пропущена, все сегменты = Speaker_1"
            )
            return []

        import asyncio

        def _diarize() -> list[dict]:
            from pyannote.audio import Pipeline

            model_id = "pyannote/speaker-diarization-3.1"

            try:
                pipeline = Pipeline.from_pretrained(model_id, token=hf_token)
            except TypeError:
                pipeline = Pipeline.from_pretrained(
                    model_id,
                    use_auth_token=hf_token,
                )
            diarization = pipeline(str(audio_path))

            result = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                result.append({
                    "start": turn.start,
                    "end": turn.end,
                    "speaker": speaker,
                })
            return result

        return await asyncio.to_thread(_diarize)

    def _merge_transcript_with_diarization(
        self,
        transcript: list[dict],
        diarization: list[dict],
    ) -> list[SpeakerSegmentSchema]:
        """Объединить результаты STT и диаризации.

        Сопоставляет текстовые сегменты из STT с метками спикеров
        из диаризации по временным меткам (overlap).

        Args:
            transcript: результат STT.
            diarization: результат диаризации.

        Returns:
            Список SpeakerSegmentSchema с привязкой к спикерам.
        """
        segments: list[SpeakerSegmentSchema] = []

        for t_seg in transcript:
            best_speaker = "Speaker_1" if not diarization else "Неизвестный"
            best_overlap = 0.0

            for d_seg in diarization:
                overlap_start = max(t_seg["start"], d_seg["start"])
                overlap_end = min(t_seg["end"], d_seg["end"])
                overlap = max(0.0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = d_seg["speaker"]

            segments.append(
                SpeakerSegmentSchema(
                    speaker=best_speaker,
                    text=t_seg["text"],
                    start_time=t_seg["start"],
                    end_time=t_seg["end"],
                )
            )

        return segments

    async def _generate_protocol(
        self,
        title: str,
        meeting_date: str,
        participants: list[str],
        segments: list[SpeakerSegmentSchema],
    ) -> MeetingProtocolSchema:
        """Сгенерировать протокол через LLM.

        Args:
            title: название совещания.
            meeting_date: дата совещания.
            participants: участники.
            segments: диаризированный транскрипт.

        Returns:
            MeetingProtocolSchema — структурированный протокол.
        """
        template = _jinja_env.get_template("protocol_generation.jinja2")
        prompt = template.render(
            title=title,
            meeting_date=meeting_date,
            participants=participants,
            segments=[s.model_dump() for s in segments],
        )

        return await self.rag_service.generate_structured(
            prompt=prompt,
            output_schema=MeetingProtocolSchema,
        )

    async def _analyze_tone(
        self,
        transcript: str,
        participants: list[str],
    ) -> ToneAnalysisSchema:
        """Проанализировать тональность через LLM.

        Загружает корпоративные стандарты из RAG и отправляет
        транскрипт на анализ.

        Args:
            transcript: полный транскрипт совещания.
            participants: участники.

        Returns:
            ToneAnalysisSchema — результат анализа.
        """
        corp_docs = await self.rag_service.search_knowledge_base(
            query="корпоративная культура стандарты общения tone of voice"
        )
        corporate_standards = "\n".join(
            doc.get("text", "") for doc in corp_docs
        ) or "Стандартные правила делового общения в российских компаниях."

        template = _jinja_env.get_template("tone_analysis.jinja2")
        prompt = template.render(
            corporate_standards=corporate_standards,
            transcript=transcript,
            participants=participants,
        )

        return await self.rag_service.generate_structured(
            prompt=prompt,
            output_schema=ToneAnalysisSchema,
        )

    async def _create_onec_tasks(
        self,
        protocol_id: int,
        action_items: list[dict],
    ) -> None:
        """Создать задачи в 1С:ЗУП по поручениям.

        Для каждого action item создаёт задачу в 1С и сохраняет
        onec_task_id обратно в БД.

        Args:
            protocol_id: идентификатор протокола.
            action_items: список поручений.
        """
        import asyncio
        from datetime import date

        for item in action_items:
            try:
                deadline = item.get("deadline")
                if isinstance(deadline, str):
                    deadline = date.fromisoformat(deadline)

                result = await asyncio.to_thread(
                    self.onec_connector.create_task,
                    title=item["text"][:200],
                    description=item["text"],
                    assignee_id=item["assignee"],
                    deadline=deadline,
                    priority=(
                        "Высокий" if item.get("priority") == "high"
                        else "Обычный"
                    ),
                )
                logger.info(
                    "Задача создана в 1С",
                    protocol_id=protocol_id,
                    assignee=item["assignee"],
                    onec_ref=result.get("Ref_Key"),
                )
            except Exception as exc:
                logger.warning(
                    "Не удалось создать задачу в 1С",
                    protocol_id=protocol_id,
                    assignee=item["assignee"],
                    error=str(exc),
                )

    def _format_protocol_text(
        self,
        protocol_data: MeetingProtocolSchema,
    ) -> str:
        """Отформатировать протокол в читаемый текст.

        Args:
            protocol_data: данные протокола.

        Returns:
            Отформатированный текст протокола.
        """
        lines: list[str] = []

        lines.append("=" * 50)
        lines.append("ПРОТОКОЛ СОВЕЩАНИЯ")
        lines.append("=" * 50)
        lines.append("")

        if protocol_data.summary:
            lines.append(f"Резюме: {protocol_data.summary}")
            lines.append("")

        if protocol_data.agenda:
            lines.append("ПОВЕСТКА:")
            for i, item in enumerate(protocol_data.agenda, 1):
                lines.append(f"  {i}. {item}")
            lines.append("")

        if protocol_data.decisions:
            lines.append("ПРИНЯТЫЕ РЕШЕНИЯ:")
            for i, decision in enumerate(protocol_data.decisions, 1):
                lines.append(f"  {i}. {decision}")
            lines.append("")

        if protocol_data.action_items:
            lines.append("ПОРУЧЕНИЯ:")
            for i, item in enumerate(protocol_data.action_items, 1):
                deadline_str = (
                    str(item.deadline) if item.deadline else "не указан"
                )
                lines.append(
                    f"  {i}. {item.text}\n"
                    f"     Ответственный: {item.assignee}\n"
                    f"     Срок: {deadline_str}\n"
                    f"     Приоритет: {item.priority.value}"
                )
            lines.append("")

        if protocol_data.next_meeting_date:
            lines.append(
                f"Следующее совещание: {protocol_data.next_meeting_date}"
            )

        return "\n".join(lines)
