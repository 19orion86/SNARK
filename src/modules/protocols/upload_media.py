"""Подготовка загружаемых файлов совещания к шифрованию и обработке.

Аудио принимаются как есть; видео (MP4 и др.) конвертируются в MP3 через ffmpeg.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

# Аудио без перекодирования (STT / Whisper обычно читают напрямую)
AUDIO_EXTENSIONS = frozenset({".mp3", ".wav", ".ogg", ".m4a", ".webm", ".opus"})

# Контейнеры «видео»: извлекаем дорожку в MP3
VIDEO_EXTENSIONS = frozenset(
    {
        ".mp4",
        ".mov",
        ".mkv",
        ".avi",
        ".mpeg",
        ".mpg",
        ".wmv",
        ".flv",
        ".3gp",
    }
)

ALLOWED_MEETING_UPLOAD_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


def is_video_extension(ext: str) -> bool:
    return ext.lower() in VIDEO_EXTENSIONS


def extract_audio_to_mp3(source: Path, output_mp3: Path) -> None:
    """Извлечь аудиодорожку из видео в MP3 (libmp3lame).

    Raises:
        FileNotFoundError: если ffmpeg не найден в PATH.
        RuntimeError: если ffmpeg завершился с ошибкой.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError(
            "Не найден ffmpeg в PATH. Установите ffmpeg и перезапустите терминал."
        )

    cmd = [
        ffmpeg,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-q:a",
        "4",
        str(output_mp3),
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=900,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        logger.error("ffmpeg завершился с ошибкой", stderr=err[:2000])
        raise RuntimeError(
            "Не удалось извлечь аудио из видео. Проверьте файл и наличие аудиодорожки."
        )


def prepare_temp_file_for_encryption(
    temp_input: Path,
    file_ext: str,
) -> tuple[Path, str]:
    """Подготовить файл к шифрованию: при необходимости видео → MP3.

    Args:
        temp_input: путь к скачанному/загруженному временному файлу.
        file_ext: суффикс в нижнем регистре, например ``.mp4``.

    Returns:
        (путь_к_файлу_для_шифрования, суффикс для итогового зашифрованного файла).

    Для видео ``temp_input`` удаляется после успешной конвертации.
    """
    ext = file_ext.lower()
    if ext not in VIDEO_EXTENSIONS:
        return temp_input, ext

    output_mp3 = temp_input.with_name(f"{temp_input.stem}_audio.mp3")
    extract_audio_to_mp3(temp_input, output_mp3)
    temp_input.unlink(missing_ok=True)
    logger.info(
        "Видео сконвертировано в MP3",
        source_ext=ext,
        output=str(output_mp3),
    )
    return output_mp3, ".mp3"
