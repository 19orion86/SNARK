"""Aiogram 3.x handlers для модуля протоколов совещаний.

Обрабатывает:
- /protocol — начало загрузки протокола (FSM)
- Загрузка аудиофайла — приём и обработка файла
- /protocol_status <id> — проверка статуса обработки
- /my_protocols — список протоколов пользователя
"""

from __future__ import annotations

import uuid
from datetime import date
from pathlib import Path

import structlog
from aiogram import F, Router, types
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from src.core.config import settings
from src.core.database import async_session_maker
from src.core.security import encrypt_file
from src.modules.protocols.repository import ProtocolRepository
from src.modules.protocols.tasks import process_meeting_audio
from src.modules.protocols.upload_media import (
    ALLOWED_MEETING_UPLOAD_EXTENSIONS,
    prepare_temp_file_for_encryption,
)

logger = structlog.get_logger(__name__)

protocol_router = Router(name="protocols")


class ProtocolUploadStates(StatesGroup):
    """Состояния FSM для загрузки протокола совещания."""

    waiting_for_title = State()
    waiting_for_date = State()
    waiting_for_participants = State()
    waiting_for_file = State()


@protocol_router.message(Command("protocol"))
async def cmd_protocol(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Начать процесс загрузки протокола совещания.

    Запускает FSM-цепочку: название → дата → участники → файл.

    Args:
        message: входящее сообщение Telegram.
        state: контекст FSM.
    """
    await state.set_state(ProtocolUploadStates.waiting_for_title)
    await message.answer(
        "<b>Загрузка протокола совещания</b>\n\n"
        "Введите название совещания:",
        parse_mode="HTML",
    )
    logger.info(
        "Начата загрузка протокола",
        telegram_id=message.from_user.id if message.from_user else None,
    )


@protocol_router.message(
    StateFilter(ProtocolUploadStates.waiting_for_title),
    F.text,
)
async def process_title(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Обработать введённое название совещания.

    Args:
        message: сообщение с названием.
        state: контекст FSM.
    """
    if not message.text or len(message.text) < 3:
        await message.answer("Название должно содержать минимум 3 символа.")
        return

    await state.update_data(title=message.text)
    await state.set_state(ProtocolUploadStates.waiting_for_date)
    await message.answer(
        "Введите дату совещания (формат: ГГГГ-ММ-ДД):\n"
        "Или отправьте <b>сегодня</b> для текущей даты.",
        parse_mode="HTML",
    )


@protocol_router.message(
    StateFilter(ProtocolUploadStates.waiting_for_date),
    F.text,
)
async def process_date(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Обработать введённую дату совещания.

    Args:
        message: сообщение с датой.
        state: контекст FSM.
    """
    if not message.text:
        return

    text = message.text.strip().lower()
    if text in ("сегодня", "today"):
        meeting_date = date.today()
    else:
        try:
            meeting_date = date.fromisoformat(text)
        except ValueError:
            await message.answer(
                "Неверный формат даты. Используйте ГГГГ-ММ-ДД "
                "(например, 2026-04-09)."
            )
            return

    await state.update_data(meeting_date=meeting_date.isoformat())
    await state.set_state(ProtocolUploadStates.waiting_for_participants)
    await message.answer(
        "Введите участников совещания через запятую:\n"
        "<i>Например: Иванов И.И., Петрова А.С., Сидоров В.В.</i>\n\n"
        "Или отправьте <b>пропустить</b>, если участники неизвестны.",
        parse_mode="HTML",
    )


@protocol_router.message(
    StateFilter(ProtocolUploadStates.waiting_for_participants),
    F.text,
)
async def process_participants(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Обработать список участников.

    Args:
        message: сообщение со списком участников.
        state: контекст FSM.
    """
    if not message.text:
        return

    text = message.text.strip().lower()
    if text in ("пропустить", "skip", "-"):
        participants: list[str] = []
    else:
        participants = [
            p.strip() for p in message.text.split(",") if p.strip()
        ]

    await state.update_data(participants=participants)
    await state.set_state(ProtocolUploadStates.waiting_for_file)
    await message.answer(
        "Отправьте аудио или видео записи совещания <b>как документ</b>.\n\n"
        "Аудио: MP3, WAV, OGG, M4A, WEBM, OPUS.\n"
        "Видео: MP4, MOV, MKV и др. (звук будет извлечён в MP3 на сервере, нужен ffmpeg).\n"
        "Максимальный размер: 200 МБ (требуется Local Bot API Server для файлов >20 МБ)",
        parse_mode="HTML",
    )


@protocol_router.message(
    StateFilter(ProtocolUploadStates.waiting_for_file),
    F.document,
)
async def process_audio_file(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Обработать загруженный аудиофайл.

    Скачивает файл, шифрует, сохраняет в БД и запускает
    Celery-задачу обработки.

    Args:
        message: сообщение с документом.
        state: контекст FSM.
    """
    document = message.document
    if not document:
        await message.answer("Пожалуйста, отправьте файл как документ.")
        return

    file_name = document.file_name or "audio.wav"
    file_ext = Path(file_name).suffix.lower()

    if file_ext not in ALLOWED_MEETING_UPLOAD_EXTENSIONS:
        await message.answer(
            f"Неподдерживаемый формат: {file_ext}\n"
            f"Допустимые: {', '.join(sorted(ALLOWED_MEETING_UPLOAD_EXTENSIONS))}"
        )
        return

    if document.file_size and document.file_size > 200 * 1024 * 1024:
        await message.answer("Файл слишком большой. Максимум — 200 МБ.")
        return

    await message.answer("Файл получен. Начинаю обработку...")

    data = await state.get_data()
    await state.clear()

    try:
        bot = message.bot
        if not bot:
            raise RuntimeError("Bot instance не найден")

        file = await bot.get_file(document.file_id)
        if not file or not file.file_path:
            raise RuntimeError("Не удалось получить файл")

        meetings_dir = settings.meetings_dir
        meetings_dir.mkdir(parents=True, exist_ok=True)

        file_uid = uuid.uuid4()
        temp_path = meetings_dir / f"temp_{file_uid}{file_ext}"
        to_encrypt: Path | None = None

        await bot.download_file(file.file_path, str(temp_path))
        try:
            to_encrypt, enc_suffix = prepare_temp_file_for_encryption(
                temp_path,
                file_ext,
            )
            encrypted_path = meetings_dir / f"enc_{file_uid}{enc_suffix}"
            encrypt_file(to_encrypt, encrypted_path)
        finally:
            if to_encrypt is not None and to_encrypt.exists():
                to_encrypt.unlink(missing_ok=True)
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)

        async with async_session_maker() as session:
            repo = ProtocolRepository(session)

            meeting_date_str = data.get("meeting_date", date.today().isoformat())

            protocol = await repo.create_protocol(
                title=data.get("title", "Совещание без названия"),
                meeting_date=date.fromisoformat(meeting_date_str),
                file_path=str(encrypted_path),
                file_original_name=file_name,
                source="telegram",
                participants=data.get("participants", []),
                uploaded_by_telegram_id=(
                    message.from_user.id if message.from_user else None
                ),
            )

            task = process_meeting_audio.delay(
                protocol_id=protocol.id,
                encrypted_file_path=str(encrypted_path),
            )
            await repo.set_celery_task_id(protocol.id, task.id)

        await message.answer(
            f"<b>Файл загружен успешно!</b>\n\n"
            f"Протокол #{protocol.id}\n"
            f"Совещание: {data.get('title')}\n"
            f"Дата: {data.get('meeting_date')}\n\n"
            f"Обработка займёт несколько минут. "
            f"Я пришлю уведомление, когда протокол будет готов.\n\n"
            f"Для проверки статуса: /protocol_status {protocol.id}",
            parse_mode="HTML",
        )

        logger.info(
            "Аудиофайл загружен и отправлен на обработку",
            protocol_id=protocol.id,
            celery_task_id=task.id,
            file_name=file_name,
        )

    except Exception as exc:
        logger.error(
            "Ошибка загрузки аудиофайла",
            error=str(exc),
            exc_info=True,
        )
        await message.answer(
            "Произошла ошибка при загрузке файла. "
            "Попробуйте ещё раз или обратитесь к администратору."
        )


@protocol_router.message(
    StateFilter(ProtocolUploadStates.waiting_for_file),
    F.voice | F.audio,
)
async def process_voice_or_audio(
    message: types.Message,
    state: FSMContext,
) -> None:
    """Обработать голосовое сообщение или аудио (не документ).

    Args:
        message: сообщение с voice/audio.
        state: контекст FSM.
    """
    await message.answer(
        "Пожалуйста, отправьте файл <b>как документ</b> "
        "(нажмите скрепку → Файл), а не как голосовое сообщение.\n\n"
        "Это нужно для сохранения качества аудио.",
        parse_mode="HTML",
    )


@protocol_router.message(Command("protocol_status"))
async def cmd_protocol_status(
    message: types.Message,
) -> None:
    """Проверить статус обработки протокола.

    Использование: /protocol_status <id>

    Args:
        message: входящее сообщение.
    """
    if not message.text:
        return

    parts = message.text.strip().split()
    if len(parts) < 2:
        await message.answer(
            "Использование: /protocol_status <номер>\n"
            "Пример: /protocol_status 42"
        )
        return

    try:
        protocol_id = int(parts[1])
    except ValueError:
        await message.answer("Номер протокола должен быть числом.")
        return

    async with async_session_maker() as session:
        repo = ProtocolRepository(session)
        protocol = await repo.get_protocol_by_id(protocol_id)

    if not protocol:
        await message.answer(f"Протокол #{protocol_id} не найден.")
        return

    status_labels = {
        "uploaded": "Загружен",
        "processing": "Обрабатывается",
        "transcribing": "Распознавание речи...",
        "generating": "Генерация протокола...",
        "completed": "Готов",
        "failed": "Ошибка",
    }
    status_text = status_labels.get(protocol.status.value, protocol.status.value)

    text = (
        f"<b>Протокол #{protocol.id}</b>\n"
        f"Совещание: {protocol.title}\n"
        f"Дата: {protocol.meeting_date}\n"
        f"Статус: <b>{status_text}</b>\n"
    )

    if protocol.status.value == "completed" and protocol.action_items:
        text += f"\nПоручений: {len(protocol.action_items)}"

    if protocol.status.value == "failed" and protocol.error_message:
        text += f"\nОшибка: {protocol.error_message[:200]}"

    await message.answer(text, parse_mode="HTML")


@protocol_router.message(Command("my_protocols"))
async def cmd_my_protocols(
    message: types.Message,
) -> None:
    """Показать список протоколов текущего пользователя.

    Args:
        message: входящее сообщение.
    """
    if not message.from_user:
        return

    async with async_session_maker() as session:
        repo = ProtocolRepository(session)
        protocols = await repo.get_protocols_list(limit=10)

    user_protocols = [
        p for p in protocols
        if p.uploaded_by_telegram_id == message.from_user.id
    ]

    if not user_protocols:
        await message.answer(
            "У вас пока нет загруженных протоколов.\n"
            "Используйте /protocol для загрузки."
        )
        return

    lines = ["<b>Ваши протоколы:</b>\n"]
    for p in user_protocols:
        status_emoji = {
            "uploaded": "\u23f3",
            "processing": "\u2699\ufe0f",
            "transcribing": "\ud83c\udfa4",
            "generating": "\ud83e\udde0",
            "completed": "\u2705",
            "failed": "\u274c",
        }.get(p.status.value, "\u2753")

        items_count = len(p.action_items) if p.action_items else 0
        lines.append(
            f"{status_emoji} #{p.id} — {p.title} "
            f"({p.meeting_date}, поручений: {items_count})"
        )

    await message.answer("\n".join(lines), parse_mode="HTML")
