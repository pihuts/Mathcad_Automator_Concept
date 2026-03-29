import multiprocessing
import queue
import time
import threading
from typing import Optional, Dict, Any
import sys
import os

try:
    from engine.protocol import JobRequest, JobResult
    from engine.harness import run_harness
    from engine.state_persistence.opened_files import OpenedFilesTracker
    from engine.batch import BatchManager
    from engine.workflow import WorkflowManager
except ModuleNotFoundError:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from engine.protocol import JobRequest, JobResult
    from engine.harness import run_harness
    from engine.state_persistence.opened_files import OpenedFilesTracker
    from engine.batch import BatchManager
    from engine.workflow import WorkflowManager


class EngineManager:
    """Manages the Mathcad engine process and job dispatch.

    Supports dependency injection for managers to enable testing with mocks.
    """

    def __init__(
        self,
        batch_manager: Optional[BatchManager] = None,
        workflow_manager: Optional[WorkflowManager] = None,
        opened_files_tracker: Optional[OpenedFilesTracker] = None,
    ):
        """Initialize the engine manager.

        Args:
            batch_manager: Optional BatchManager instance (created if not provided)
            workflow_manager: Optional WorkflowManager instance (created if not provided)
            opened_files_tracker: Optional OpenedFilesTracker instance (created if not provided)
        """
        self.process: Optional[multiprocessing.Process] = None
        self.input_queue: Optional[multiprocessing.Queue] = None
        self.output_queue: Optional[multiprocessing.Queue] = None

        # Result storage
        self.results: Dict[str, JobResult] = {}
        self.result_events: Dict[str, threading.Event] = {}
        self.result_lock = threading.Lock()
        self.collector_thread: Optional[threading.Thread] = None
        self.stop_collector: bool = False

        # Managers - inject or create defaults
        if batch_manager is not None:
            self.batch_manager = batch_manager
        else:
            self.batch_manager = BatchManager(self)

        if workflow_manager is not None:
            self.workflow_manager = workflow_manager
        else:
            self.workflow_manager = WorkflowManager(self)

        # Opened files tracker for recovery after frontend disconnect
        self.opened_files_tracker = opened_files_tracker or OpenedFilesTracker()

    def get_opened_files(self) -> list:
        """
        Return the list of currently opened Mathcad files.

        Returns:
            List of absolute file paths that are currently open.
        """
        return self.opened_files_tracker.list_files()
        
    def start_engine(self):
        """Starts the sidecar process and result collector."""
        if self.is_running():
            print("Engine already running.")
            return

        self.input_queue = multiprocessing.Queue()
        self.output_queue = multiprocessing.Queue()
        
        self.process = multiprocessing.Process(
            target=run_harness,
            args=(self.input_queue, self.output_queue),
            daemon=True 
        )
        self.process.start()
        print(f"Engine started with PID: {self.process.pid}")
        
        # Start collector thread
        self.stop_collector = False
        self.collector_thread = threading.Thread(target=self._collect_results, daemon=True)
        self.collector_thread.start()

    def stop_engine(self):
        """Stops the sidecar process gracefully, then forcefully."""
        if not self.is_running():
            return

        print("Stopping engine...")
        
        # Stop collector
        self.stop_collector = True
        if self.collector_thread:
            self.collector_thread.join(timeout=1.0)
            
        try:
            if self.input_queue:
                self.input_queue.put(None)
            if self.process:
                self.process.join(timeout=2.0)
        except Exception as e:
            print(f"Error during graceful shutdown: {e}")

        if self.process and self.process.is_alive():
            print("Engine did not stop gracefully, terminating...")
            self.process.terminate()
            self.process.join(timeout=1.0)
        
        self.process = None
        self.input_queue = None
        self.output_queue = None
        self.collector_thread = None
        with self.result_lock:
            self.results.clear()
            self.result_events.clear()
        print("Engine stopped.")

    def restart_engine(self):
        self.stop_engine()
        self.start_engine()

    def is_running(self) -> bool:
        return self.process is not None and self.process.is_alive()

    def submit_job(self, command: str, payload: Optional[Dict[str, Any]] = None) -> str:
        """
        Submits a job to the engine. Returns the job ID.
        """
        if not self.is_running() or self.input_queue is None:
            raise RuntimeError("Engine is not running")
            
        if payload is None:
            payload = {}
            
        req = JobRequest(command=command, payload=payload)
        print(f"[manager] Submitting job {req.id} | command: {command} | payload keys: {list(payload.keys())}")
        with self.result_lock:
            self.result_events[req.id] = threading.Event()
        self.input_queue.put(req)
        return req.id
        
    def _collect_results(self):
        """Background thread to drain output queue into results dict."""
        while not self.stop_collector:
            if not self.output_queue:
                break
            try:
                # Short timeout to allow checking stop_collector
                result = self.output_queue.get(timeout=1.0)
                if result:
                    print(f"[manager] Collected result for job {result.job_id} | status: {result.status}")
                    with self.result_lock:
                        self.results[result.job_id] = result
                        event = self.result_events.get(result.job_id)
                        if event is None:
                            event = threading.Event()
                            self.result_events[result.job_id] = event
                        event.set()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in result collector: {e}")
                
    def get_job(self, job_id: str) -> Optional[JobResult]:
        """Returns the result of a job if available."""
        with self.result_lock:
            return self.results.get(job_id)

    def wait_for_result(self, job_id: str, timeout: float = 600.0) -> Optional[JobResult]:
        """Blocking wait for job result with timeout.

        Args:
            job_id: Job identifier to wait for
            timeout: Maximum time to wait in seconds

        Returns:
            JobResult if available, None if timeout
        """
        with self.result_lock:
            if job_id in self.results:
                return self.results[job_id]
            event = self.result_events.get(job_id)
            if event is None:
                event = threading.Event()
                self.result_events[job_id] = event

        signaled = event.wait(timeout=timeout)
        if not signaled:
            return None
        with self.result_lock:
            return self.results.get(job_id)

