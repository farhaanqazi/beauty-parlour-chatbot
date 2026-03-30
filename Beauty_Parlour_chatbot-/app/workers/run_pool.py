from __future__ import annotations

from multiprocessing import Process

from app.core.config import get_settings
from app.workers.notification_worker import main as run_notification_worker


def main() -> None:
    settings = get_settings()
    processes: list[Process] = []
    try:
        for _ in range(settings.notification_workers):
            process = Process(target=run_notification_worker)
            process.start()
            processes.append(process)
        for process in processes:
            process.join()
    except KeyboardInterrupt:
        for process in processes:
            if process.is_alive():
                process.terminate()
        for process in processes:
            process.join()


if __name__ == "__main__":
    main()
