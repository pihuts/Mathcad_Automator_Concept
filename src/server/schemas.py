from pydantic import BaseModel
from typing import Dict, Any, List, Optional, Literal
from enum import Enum

class OutputDirMode(str, Enum):
    working = "working"
    source = "source"
    custom = "custom"

class OutputDirSettingsRequest(BaseModel):
    mode: OutputDirMode
    custom_path: Optional[str] = None
    source_file_path: Optional[str] = None

class OutputDirSettingsResponse(BaseModel):
    valid: bool
    resolved_path: Optional[str] = None
    error: Optional[str] = None
    mode: OutputDirMode

class JobSubmission(BaseModel):
    command: str
    payload: Dict[str, Any] = {}

class JobResponse(BaseModel):
    job_id: str
    status: str = "submitted"

class ControlResponse(BaseModel):
    status: str
    message: str

class BatchRequest(BaseModel):
    batch_id: str
    inputs: List[Dict[str, Any]]
    output_dir: Optional[str] = None
    output_dir_mode: Optional[OutputDirMode] = None
    source_file_path: Optional[str] = None
    export_pdf: bool = False
    export_mcdx: bool = False
    mode: Literal['combination', 'zip'] = 'combination'
    output_units: Dict[str, str] = {}
    overwrite_existing: bool = True


class WorkflowMappingRequest(BaseModel):
    source_file: str
    source_alias: str
    source_type: Literal["input", "output"] = "output"
    target_file: str
    target_alias: str
    units: Optional[str] = None

class BatchRow(BaseModel):
    row: int
    status: str
    stage: Optional[str] = None
    inputs: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None
    pdf: Optional[str] = None
    mcdx: Optional[str] = None
    error: Optional[str] = None

class BatchStatus(BaseModel):
    id: str
    total: int
    completed: int
    status: str
    results: List[BatchRow]
    generated_files: List[str] = []
    error: Optional[str] = None

class SaveLibraryConfigRequest(BaseModel):
    name: str
    file_path: str
    inputs: List[Dict[str, Any]]
    export_pdf: bool = False
    export_mcdx: bool = False
    output_dir: Optional[str] = None

class SaveLibraryConfigResponse(BaseModel):
    status: str
    config_path: str
    config_name: str

class LibraryConfigMetadata(BaseModel):
    name: str
    path: str
    created_at: str
    version: str = "1.0"

class ListLibraryConfigsResponse(BaseModel):
    configs: List[LibraryConfigMetadata]

class LoadLibraryConfigRequest(BaseModel):
    config_path: str
