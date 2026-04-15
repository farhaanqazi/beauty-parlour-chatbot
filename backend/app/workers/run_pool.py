from __future__ import annotations

from multiprocessing import Process

from app.core.config import get_settings
from app.workers.lifecycle_worker import main as run_lifecycle_worker
from app.workers.notification_worker import main as run_notification_worker


def main() -> None:
    settings = get_settings()
    processes: list[Process] = []
    try:
        for _ in range(settings.notification_workers):
            process = Process(target=run_notification_worker)
            process.start()
            processes.append(process)

        # Single lifecycle worker is sufficient — it uses skip_locked so running
        # multiple copies is safe, but one is enough at any poll interval >= 60 s.
        lifecycle_process = Process(target=run_lifecycle_worker)
        lifecycle_process.start()
        processes.append(lifecycle_process)

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
