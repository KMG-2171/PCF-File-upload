import { IInputs, IOutputs } from "./generated/ManifestTypes";

// File upload interfaces
interface FileUploadItem {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
    blobUrl?: string;
    xhr?: XMLHttpRequest;
    retryCount?: number;
}

interface SASResponse {
    uploadUrl: string;
    blobName: string;
    expiresAt?: string;
}

interface NotificationItem {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning';
    duration?: number;
}

export class customFileUpload implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    // Core UI Elements
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    // Upload state
    private _files: Map<string, FileUploadItem> = new Map<string, FileUploadItem>();
    private _notifications: NotificationItem[] = [];
    private _isUploading = false;

    // UI Elements
    private _mainContainer: HTMLDivElement;
    private _dropZone: HTMLDivElement;
    private _fileInput: HTMLInputElement;
    private _fileList: HTMLDivElement;
    private _notificationContainer: HTMLDivElement;
    private _uploadAllButton: HTMLButtonElement;
    private _cancelAllButton: HTMLButtonElement;

    // Event handlers (bound once to avoid memory leaks)
    private _boundDragOverHandler: (e: DragEvent) => void;
    private _boundDragLeaveHandler: (e: DragEvent) => void;
    private _boundDropHandler: (e: DragEvent) => void;
    private _boundFileSelectedHandler: (e: Event) => void;
    private _boundUploadAllHandler: () => void;
    private _boundCancelAllHandler: () => void;
    private _boundKeyDownHandler: (e: KeyboardEvent) => void;

    // Configuration
    private _maxFileSize: number;
    private _maxFileCount: number;
    private _enableMultiple: boolean;
    private _enableChunkedUpload: boolean;
    private _chunkSize: number;
    private _acceptedTypes: string[];

    // File type mappings
    private _fileTypeMap: Record<string, string[]> = {
        "PDF": [".pdf", "application/pdf"],
        "CSV": [".csv", "text/csv", "application/csv"],
        "Word": [".doc", ".docx", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "Excel": [".xls", ".xlsx", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        "PowerPoint": [".ppt", ".pptx", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
        "Image": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp"],
        "Text": [".txt", "text/plain"],
        "All": ["*"]
    };

    // File type icons
    private _fileIcons: Record<string, string> = {
        "pdf": "📄",
        "doc": "📘",
        "docx": "📘",
        "xls": "📗",
        "xlsx": "📗",
        "ppt": "📙",
        "pptx": "📙",
        "csv": "📊",
        "jpg": "🖼️",
        "jpeg": "🖼️",
        "png": "🖼️",
        "gif": "🖼️",
        "bmp": "🖼️",
        "webp": "🖼️",
        "txt": "📝",
        "default": "📎"
    };

    constructor() {
        // Bind event handlers once to avoid memory leaks
        this._boundDragOverHandler = this.handleDragOver.bind(this);
        this._boundDragLeaveHandler = this.handleDragLeave.bind(this);
        this._boundDropHandler = this.handleDrop.bind(this);
        this._boundFileSelectedHandler = this.handleFileSelected.bind(this);
        this._boundUploadAllHandler = this.handleUploadAll.bind(this);
        this._boundCancelAllHandler = this.handleCancelAll.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
    }

    /**
     * Safely read a manifest parameter's raw value as a typed value.
     */
    private getParamRaw<T>(name: string): T | undefined {
        const params = this._context.parameters as unknown as Record<string, { raw?: unknown }>;
        const entry = params ? params[name] : undefined;
        return (entry && (entry.raw as T)) || undefined;
    }

    /**
     * Initialize the control instance
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;

        // Initialize configuration
        this.initializeConfiguration();

        // Create the UI
        this.createUI();
    }

    /**
     * Initialize configuration from manifest properties
     */
    private initializeConfiguration(): void {
        this._maxFileSize = (this._context.parameters.maxFileSizeMB.raw || 100) * 1024 * 1024; // Convert MB to bytes
        this._maxFileCount = this._context.parameters.maxFileCount.raw || 10;
        this._enableMultiple = this._context.parameters.enableMultiple.raw || false;
        this._enableChunkedUpload = this._context.parameters.enableChunkedUpload.raw || false;
        this._chunkSize = (this._context.parameters.chunkSizeMB.raw || 10) * 1024 * 1024; // Convert MB to bytes

        const acceptedType = this._context.parameters.acceptedFileTypes.raw || "All";
        this._acceptedTypes = this._fileTypeMap[acceptedType] || ["*"];
    }

    /**
     * Create the main UI structure
     */
    private createUI(): void {
        // Main container
        this._mainContainer = document.createElement("div");
        this._mainContainer.className = "file-upload-container";

        // Header
        const header = this.createHeader();
        this._mainContainer.appendChild(header);

        // Drop zone
        this._dropZone = this.createDropZone();
        this._mainContainer.appendChild(this._dropZone);

        // File list (initially hidden)
        this._fileList = document.createElement("div");
        this._fileList.className = "file-list";
        this._fileList.style.display = "none";
        this._mainContainer.appendChild(this._fileList);

        // Action buttons
        const actionButtons = this.createActionButtons();
        this._mainContainer.appendChild(actionButtons);

        // Notification container
        this._notificationContainer = document.createElement("div");
        this._notificationContainer.className = "notification-container";
        this._notificationContainer.setAttribute("aria-live", "polite");
        this._notificationContainer.setAttribute("aria-atomic", "false");
        this._mainContainer.appendChild(this._notificationContainer);

        // Hidden file input
        this._fileInput = document.createElement("input");
        this._fileInput.type = "file";
        this._fileInput.style.display = "none";
        this._fileInput.multiple = this._enableMultiple;
        this._fileInput.accept = this.getAcceptedFileTypesString();
        this._fileInput.addEventListener("change", this._boundFileSelectedHandler);

        // Add to container
        this._container.appendChild(this._fileInput);
        this._container.appendChild(this._mainContainer);

        // Add global styles if not already added
        this.ensureGlobalStyles();
    }

    /**
     * Create header section
     */
    private createHeader(): HTMLDivElement {
        const header = document.createElement("div");
        header.className = "upload-header";

        const title = document.createElement("h2");
        title.className = "upload-title";
        title.innerHTML = `<span>☁️</span> File Upload`;
        header.appendChild(title);

        const subtitle = document.createElement("p");
        subtitle.className = "upload-subtitle";
        subtitle.textContent = this.getUploadHintText();
        header.appendChild(subtitle);

        return header;
    }

    /**
     * Create drop zone
     */
    private createDropZone(): HTMLDivElement {
        const dropZone = document.createElement("div");
        dropZone.className = "drop-zone";
        dropZone.setAttribute("role", "button");
        dropZone.setAttribute("tabindex", "0");
        dropZone.setAttribute("aria-label", "Drop files here or click to select files");

        const content = document.createElement("div");
        content.className = "drop-zone-content";

        const icon = document.createElement("div");
        icon.className = "drop-zone-icon";
        icon.textContent = "☁️";

        const text = document.createElement("div");
        text.className = "drop-zone-text";
        text.textContent = "Drop files here or click to browse";

        const hint = document.createElement("div");
        hint.className = "drop-zone-hint";
        hint.textContent = this.getAcceptedFileTypesDescription();

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(hint);
        dropZone.appendChild(content);

        // Event listeners
        dropZone.addEventListener("click", () => this._fileInput.click());
        dropZone.addEventListener("dragover", this._boundDragOverHandler);
        dropZone.addEventListener("dragleave", this._boundDragLeaveHandler);
        dropZone.addEventListener("drop", this._boundDropHandler);
        dropZone.addEventListener("keydown", this._boundKeyDownHandler);

        return dropZone;
    }

    /**
     * Create action buttons
     */
    private createActionButtons(): HTMLDivElement {
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "button-container";

        this._uploadAllButton = document.createElement("button");
        this._uploadAllButton.className = "btn btn-primary";
        this._uploadAllButton.innerHTML = `<span>☁️</span> Upload`;
        this._uploadAllButton.disabled = true;
        this._uploadAllButton.addEventListener("click", this._boundUploadAllHandler);

        this._cancelAllButton = document.createElement("button");
        this._cancelAllButton.className = "btn btn-danger";
        this._cancelAllButton.innerHTML = `<span>✕</span> Cancel All`;
        this._cancelAllButton.disabled = true;
        this._cancelAllButton.style.display = "none";
        this._cancelAllButton.addEventListener("click", this._boundCancelAllHandler);

        buttonContainer.appendChild(this._uploadAllButton);
        buttonContainer.appendChild(this._cancelAllButton);

        return buttonContainer;
    }

    /**
     * Drag and drop handlers
     */
    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this._dropZone.classList.add("drag-over");
    }

    private handleDragLeave(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this._dropZone.classList.remove("drag-over");
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this._dropZone.classList.remove("drag-over");

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            this.handleFiles(e.dataTransfer.files);
        }
    }

    /**
     * Handle keyboard navigation for drop zone
     */
    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this._fileInput.click();
        }
    }

    /**
     * Handle file selection from input
     */
    private handleFileSelected(e: Event): void {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            this.handleFiles(target.files);
        }
        // Reset input to allow selecting the same file again
        target.value = "";
    }

    /**
     * Process selected files
     */
    private handleFiles(files: FileList): void {
        const filesToProcess = Array.from(files);

        if (!this._enableMultiple && filesToProcess.length > 1) {
            this.showNotification("Multiple file selection is disabled. Only the first file will be added.", "warning");
            filesToProcess.splice(1);
        }

        if (this._files.size + filesToProcess.length > this._maxFileCount) {
            this.showNotification(`Maximum file count is ${this._maxFileCount}. Some files were not added.`, "warning");
            filesToProcess.splice(this._maxFileCount - this._files.size);
        }

        let addedCount = 0;
        for (const file of filesToProcess) {
            if (this.validateFile(file)) {
                const fileId = this.generateFileId();
                const fileItem: FileUploadItem = {
                    id: fileId,
                    file: file,
                    status: 'pending',
                    progress: 0,
                    retryCount: 0
                };
                this._files.set(fileId, fileItem);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            this.updateFileList();
            this.updateActionButtons();
            this.showNotification(`Added ${addedCount} file${addedCount > 1 ? 's' : ''} to upload queue.`, "success");
        }
    }

    /**
     * Validate file against constraints
     */
    private validateFile(file: File): boolean {
        // Check file size
        if (file.size > this._maxFileSize) {
            this.showNotification(`File "${file.name}" exceeds maximum size of ${this.formatFileSize(this._maxFileSize)}.`, "error");
            return false;
        }

        // Check file type
        if (!this.isFileTypeValid(file)) {
            this.showNotification(`File type "${file.type}" is not supported.`, "error");
            return false;
        }

        // Check for duplicates
        for (const [id, item] of this._files) {
            if (item.file.name === file.name && item.file.size === file.size) {
                this.showNotification(`File "${file.name}" is already in the upload queue.`, "warning");
                return false;
            }
        }

        return true;
    }

    /**
     * Check if file type is accepted
     */
    private isFileTypeValid(file: File): boolean {
        if (this._acceptedTypes.includes("*")) return true;

        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();

        return this._acceptedTypes.some(acceptedType => {
            if (acceptedType === "*") return true;
            if (acceptedType.startsWith(".") && fileName.endsWith(acceptedType.toLowerCase())) return true;
            if (acceptedType.includes("/") && fileType === acceptedType.toLowerCase()) return true;
            return false;
        });
    }

    /**
     * Update file list display
     */
    private updateFileList(): void {
        this._fileList.innerHTML = "";

        if (this._files.size === 0) {
            this._fileList.style.display = "none";
            return;
        }

        this._fileList.style.display = "flex";

        for (const [fileId, fileItem] of this._files) {
            const fileElement = this.createFileElement(fileItem);
            this._fileList.appendChild(fileElement);
        }
    }

    /**
     * Create file item element
     */
    private createFileElement(fileItem: FileUploadItem): HTMLDivElement {
        const fileDiv = document.createElement("div");
        fileDiv.className = `file-item ${fileItem.status}`;
        fileDiv.setAttribute("data-file-id", fileItem.id);

        // File icon container
        const iconContainer = document.createElement("div");
        iconContainer.className = "file-icon-container";

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.textContent = this.getFileIcon(fileItem.file.name);

        iconContainer.appendChild(icon);

        // File details
        const details = document.createElement("div");
        details.className = "file-details";

        const fileName = document.createElement("div");
        fileName.className = "file-name";
        fileName.textContent = fileItem.file.name;
        fileName.title = fileItem.file.name; // Tooltip for long names

        const meta = document.createElement("div");
        meta.className = "file-meta";

        const size = document.createElement("span");
        size.className = "file-size";
        size.textContent = this.formatFileSize(fileItem.file.size);

        const status = document.createElement("span");
        status.className = `file-status ${fileItem.status}`;
        status.textContent = this.getStatusText(fileItem.status);

        meta.appendChild(size);
        meta.appendChild(status);

        details.appendChild(fileName);
        details.appendChild(meta);

        // Progress bar (for uploading files)
        if (fileItem.status === 'uploading') {
            const progressContainer = document.createElement("div");
            progressContainer.className = "progress-container";

            const progressBar = document.createElement("div");
            progressBar.className = "progress-bar";

            const progressFill = document.createElement("div");
            progressFill.className = "progress-fill";
            progressFill.style.width = `${fileItem.progress}%`;

            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);
            details.appendChild(progressContainer);
        }

        // Actions
        const actions = document.createElement("div");
        actions.className = "file-actions";

        // Retry button for failed uploads
        if (fileItem.status === 'error') {
            const retryBtn = document.createElement("button");
            retryBtn.className = "file-action-btn retry";
            retryBtn.innerHTML = "🔄";
            retryBtn.title = "Retry upload";
            retryBtn.addEventListener("click", () => this.retryUpload(fileItem.id));
            actions.appendChild(retryBtn);
        }

        // Cancel/Remove button
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "file-action-btn remove";
        cancelBtn.innerHTML = fileItem.status === 'uploading' ? "⏹️" : "✕";
        cancelBtn.title = fileItem.status === 'uploading' ? "Cancel upload" : "Remove file";
        cancelBtn.addEventListener("click", () => this.removeFile(fileItem.id));
        actions.appendChild(cancelBtn);

        // Assemble file element
        fileDiv.appendChild(iconContainer);
        fileDiv.appendChild(details);
        fileDiv.appendChild(actions);

        return fileDiv;
    }

    /**
     * Handle upload all action
     */
    private handleUploadAll(): void {
        const pendingFiles = Array.from(this._files.values()).filter(f => f.status === 'pending');
        if (pendingFiles.length === 0) return;

        this._isUploading = true;
        this.updateActionButtons();

        // Upload files sequentially (can be made parallel with proper rate limiting)
        this.uploadFilesSequentially(pendingFiles);
    }

    /**
     * Upload files one by one
     */
    private async uploadFilesSequentially(files: FileUploadItem[]): Promise<void> {
        for (const fileItem of files) {
            if (!this._isUploading) break; // User cancelled

            try {
                await this.uploadFile(fileItem);
            } catch (error) {
                console.error("Upload failed:", error);
                // Continue with next file even if one fails
            }
        }

        this._isUploading = false;
        this.updateActionButtons();
        this.checkAllUploadsComplete();
    }

    /**
     * Upload a single file
     */
    private async uploadFile(fileItem: FileUploadItem): Promise<void> {
        fileItem.status = 'uploading';
        fileItem.progress = 0;
        this.updateFileItem(fileItem.id);

        try {
            const requestedMode = (this._context.parameters.uploadAuthMode.raw as unknown as string) || "SASFromServer";

            // Defensive override: if direct OneLake inputs are present, prefer direct mode
            const directFolder = this.getParamRaw<string>("oneLakeFolderUrl") || "";
            const directToken = this.getParamRaw<string>("aadAccessToken") || "";
            const hasDirectInputs = !!directFolder && !!directToken;

            const aadTokenUrl = this.getParamRaw<string>("aadTokenRequestUrl") || "";
            const hasAadIssuer = !!aadTokenUrl;

            const authMode =
                requestedMode === "OneLakeDirectToken" ? "OneLakeDirectToken" :
                requestedMode === "OneLakeAAD" && !hasAadIssuer && hasDirectInputs ? "OneLakeDirectToken" :
                requestedMode;

            if (authMode === "OneLakeAAD") {
                // Upload to Microsoft OneLake via ADLS Gen2 DFS REST API
                await this.uploadToOneLake(fileItem);
            } else if (authMode === "OneLakeDirectToken") {
                await this.uploadToOneLakeDirect(fileItem);
            } else {
                // Get upload URL based on authentication mode (Azure Blob)
                const uploadUrl = await this.getUploadUrl(fileItem.file);
                // Perform upload with real progress tracking
                await this.uploadToAzureStorage(fileItem, uploadUrl);
            }

            // Mark as successful
            fileItem.status = 'success';
            fileItem.progress = 100;
            this.updateFileItem(fileItem.id);

        } catch (error) {
            console.error(`Upload failed for ${fileItem.file.name}:`, error);
            fileItem.status = 'error';
            fileItem.error = error instanceof Error ? error.message : 'Unknown error';
            this.updateFileItem(fileItem.id);
            this.showNotification(`Upload failed for ${fileItem.file.name}: ${fileItem.error}`, "error");
            throw error;
        }
    }

    /**
     * Get upload URL based on authentication mode
     */
    private async getUploadUrl(file: File): Promise<string> {
        const authMode = (this._context.parameters.uploadAuthMode.raw as unknown as string) || "SASFromServer";
        const storageAccount = this._context.parameters.storageAccountName.raw || "";
        const containerName = this._context.parameters.containerName.raw || "";

        if (!storageAccount || !containerName) {
            throw new Error("Storage account name and container name are required");
        }

        const blobName = this.generateBlobName(file);
        const blobUrl = `https://${storageAccount}.blob.core.windows.net/${containerName}/${blobName}`;

        let sasToken: string;
        let uploadEndpoint: string;

        switch (authMode) {
            case "SASFromServer":
                return this.getSASUrlFromServer(blobName);

            case "DirectSASToken":
                sasToken = this.getParamRaw<string>("sasToken") || "";
                if (!sasToken) {
                    throw new Error("SAS token is required for DirectSASToken mode");
                }
                return `${blobUrl}?${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;

            case "ServerProxyUpload":
                uploadEndpoint = this.getParamRaw<string>("uploadEndpoint") || "";
                if (!uploadEndpoint) {
                    throw new Error("Upload endpoint is required for ServerProxyUpload mode");
                }
                return `${uploadEndpoint}?blobName=${encodeURIComponent(blobName)}`;

            default:
                throw new Error(`Unsupported authentication mode: ${authMode}`);
        }
    }

    /**
     * Get SAS URL from server endpoint
     */
    private async getSASUrlFromServer(blobName: string): Promise<string> {
        const sasRequestUrl = this.getParamRaw<string>("sasRequestUrl") || "";
        if (!sasRequestUrl) {
            throw new Error("SAS request URL is required for SASFromServer mode");
        }

        const url = new URL(sasRequestUrl);
        url.searchParams.append('blobName', blobName);
        url.searchParams.append('permission', 'rw');
        url.searchParams.append('duration', '3600'); // 1 hour

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get SAS token: ${response.status} ${response.statusText}`);
        }

        const data: SASResponse = await response.json();
        return data.uploadUrl;
    }

    /**
     * Upload file to Azure Storage with real progress tracking
     */
    private async uploadToAzureStorage(fileItem: FileUploadItem, uploadUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            fileItem.xhr = xhr;

            // Progress tracking
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    fileItem.progress = Math.round((e.loaded / e.total) * 100);
                    this.updateFileItem(fileItem.id);
                }
            });

            // Completion
            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    fileItem.blobUrl = uploadUrl.split('?')[0]; // Remove SAS token for storage
                    resolve();
                } else {
                    const errorText = xhr.responseText || `HTTP ${xhr.status}`;
                    reject(new Error(`Upload failed: ${errorText}`));
                }
            });

            // Error handling
            xhr.addEventListener("error", () => {
                reject(new Error("Network error during upload"));
            });

            xhr.addEventListener("abort", () => {
                reject(new Error("Upload was cancelled"));
            });

            // Prepare headers
            const headers: Record<string, string> = {
                "x-ms-blob-type": "BlockBlob",
                "x-ms-version": "2024-11-04",
                "Content-Type": fileItem.file.type || "application/octet-stream"
            };

            // Add metadata if enabled
            if (this._context.parameters.enableMetadata.raw) {
                const metadata = this.generateMetadata(fileItem.file);
                for (const [key, value] of Object.entries(metadata)) {
                    const sanitizedKey = this.sanitizeMetadataKey(key);
                    headers[`x-ms-meta-${sanitizedKey}`] = encodeURIComponent(value);
                }
            }

            // Open and send request
            xhr.open("PUT", uploadUrl, true);

            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }

            xhr.send(fileItem.file);
        });
    }

    /**
     * Upload file to Microsoft OneLake (ADLS Gen2 DFS) using AAD Bearer token
     * Flow: create (PUT ?resource=file) -> append (PATCH ?action=append&position=offset)* -> flush (PATCH ?action=flush&position=length)
     */
    private async uploadToOneLake(fileItem: FileUploadItem): Promise<void> {
        const accessToken = await this.getOneLakeAccessToken();

        const workspaceId = this.getParamRaw<string>("oneLakeWorkspaceId") || "";
        const lakehouseId = this.getParamRaw<string>("oneLakeLakehouseId") || "";
        const basePath = (this.getParamRaw<string>("oneLakeBasePath") || "Files").replace(/^\/+|\/+$/g, "");
        const userSubPath = this.resolveUserSubPath();

        if (!workspaceId || !lakehouseId) {
            throw new Error("OneLake workspace ID and lakehouse ID are required for OneLakeAAD mode");
        }

        const blobName = this.generateBlobName(fileItem.file);
        const dfsBase = `https://onelake.dfs.fabric.microsoft.com/${workspaceId}/${lakehouseId}`;
        const filePath = `${basePath}/${userSubPath}/${blobName}`.replace(/\/{2,}/g, "/");
        const fileUrl = `${dfsBase}/${encodeURI(filePath)}`;

        // 1) Create empty file
        await this.oneLakeCreateFile(fileUrl, accessToken);

        // 2) Append chunks
        const chunkSize =
            (((this.getParamRaw<number>("oneLakeChunkSizeMB") || 8) * 1024 * 1024) >>> 0);
        const total = fileItem.file.size;
        let offset = 0;

        while (offset < total) {
            if (!this._isUploading) {
                throw new Error("Upload was cancelled");
            }

            const end = Math.min(offset + chunkSize, total);
            const chunk = fileItem.file.slice(offset, end);
            await this.oneLakeAppendChunk(fileUrl, accessToken, offset, chunk);

            offset = end;
            // coarse progress (per chunk)
            fileItem.progress = Math.min(99, Math.round((offset / total) * 100));
            this.updateFileItem(fileItem.id);
        }

        // 3) Flush
        await this.oneLakeFlushFile(fileUrl, accessToken, total);

        // Store final path without query
        fileItem.blobUrl = fileUrl;
    }

    /**
     * Resolve per-user sub-path. If property provided, use it; otherwise derive a safe default.
     */
    private resolveUserSubPath(): string {
        const configured = (this.getParamRaw<string>("oneLakeUserSubPath") || "").trim();
        if (configured) {
            return configured.replace(/^\/+|\/+$/g, "");
        }

        // Derive from current user if available, else 'anonymous'
        // Note: availability of user info varies between Canvas and Model-driven apps.
        // Fallback is a stable 'anonymous' bucket.
        const userSettings = (this._context as unknown as { userSettings?: { userName?: string; userId?: string } }).userSettings;
        const userName = (userSettings && (userSettings.userName || userSettings.userId)) || "anonymous";

        return this.sanitizePathSegment(String(userName));
    }

    /**
     * Sanitize a path segment for OneLake/DFS URLs
     */
    private sanitizePathSegment(segment: string): string {
        return segment
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-_./]/g, "-")
            .replace(/\/{2,}/g, "/")
            .replace(/^\/+|\/+$/g, "");
    }

    /**
     * Create an empty file in OneLake (DFS)
     */
    private async oneLakeCreateFile(fileUrl: string, accessToken: string): Promise<void> {
        const url = `${fileUrl}?resource=file`;
        const resp = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "x-ms-version": "2023-11-03",
                "Content-Length": "0"
            }
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OneLake create failed: ${resp.status} ${resp.statusText} - ${text}`);
        }
    }

    /**
     * Append a chunk to the OneLake file
     */
    private async oneLakeAppendChunk(fileUrl: string, accessToken: string, position: number, chunk: Blob): Promise<void> {
        const url = `${fileUrl}?action=append&position=${position}`;
        const resp = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "x-ms-version": "2023-11-03",
                "Content-Type": "application/octet-stream",
                // Content-Length is set automatically by browser for fetch with Blob
            } as Record<string, string>,
            body: chunk
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OneLake append failed at ${position}: ${resp.status} ${resp.statusText} - ${text}`);
        }
    }

    /**
     * Flush the OneLake file after all data appended
     */
    private async oneLakeFlushFile(fileUrl: string, accessToken: string, totalLength: number): Promise<void> {
        const url = `${fileUrl}?action=flush&position=${totalLength}`;
        const resp = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "x-ms-version": "2023-11-03",
                "Content-Length": "0"
            }
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OneLake flush failed: ${resp.status} ${resp.statusText} - ${text}`);
        }
    }

    // ===== OneLake Token Handling =====

    private _oneLakeTokenCache?: { token: string; expires: number };

    /**
     * Acquire OneLake (ADLS Gen2) access token from server. Cache until close to expiry.
     * Expected server response: { accessToken: string, expiresAt: string }
     */
    private async getOneLakeAccessToken(): Promise<string> {
        const now = Date.now();
        if (this._oneLakeTokenCache && this._oneLakeTokenCache.expires - 120000 > now) {
            return this._oneLakeTokenCache.token;
        }

        const tokenUrl = this.getParamRaw<string>("aadTokenRequestUrl") || "";
        if (!tokenUrl) {
            throw new Error("AAD Token Request URL is required for OneLakeAAD mode");
        }

        const resp = await fetch(tokenUrl, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });
        if (!resp.ok) {
            throw new Error(`Failed to acquire OneLake token: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json() as { accessToken?: string; expiresAt?: string; expires_in?: number };
        const token = data.accessToken;
        if (!token) {
            throw new Error("Invalid token response from server");
        }

        let expires = now + 55 * 60 * 1000; // default 55m
        if (data.expiresAt) {
            const t = Date.parse(data.expiresAt);
            if (!isNaN(t)) expires = t;
        } else if (typeof data.expires_in === "number") {
            expires = now + (data.expires_in * 1000);
        }

        this._oneLakeTokenCache = { token, expires };
        return token;
    }

    /**
     * OneLake direct-token mode: caller provides folder URL and bearer token.
     * Builds the file URL by appending the generated blob name to the folder URL.
     */
    private async uploadToOneLakeDirect(fileItem: FileUploadItem): Promise<void> {
        const folderUrlRaw = this.getParamRaw<string>("oneLakeFolderUrl") || "";
        const bearerToken = this.getParamRaw<string>("aadAccessToken") || "";

        if (!folderUrlRaw) {
            throw new Error("OneLake folder URL is required for OneLakeDirectToken mode");
        }
        if (!bearerToken) {
            throw new Error("AAD Access Token is required for OneLakeDirectToken mode");
        }

        // Normalize folder URL (strip trailing slash)
        const folderUrl = folderUrlRaw.replace(/\/+$/g, "");
        const fileName = this.generateBlobName(fileItem.file);
        const fileUrl = `${folderUrl}/${encodeURIComponent(fileName)}`;

        // Create -> Append chunks -> Flush
        await this.oneLakeCreateFile(fileUrl, bearerToken);

        const chunkSize = (((this.getParamRaw<number>("oneLakeChunkSizeMB") || 8) * 1024 * 1024) >>> 0);
        const total = fileItem.file.size;
        let offset = 0;

        while (offset < total) {
            if (!this._isUploading) {
                throw new Error("Upload was cancelled");
            }
            const end = Math.min(offset + chunkSize, total);
            const chunk = fileItem.file.slice(offset, end);
            await this.oneLakeAppendChunk(fileUrl, bearerToken, offset, chunk);
            offset = end;
            fileItem.progress = Math.min(99, Math.round((offset / total) * 100));
            this.updateFileItem(fileItem.id);
        }

        await this.oneLakeFlushFile(fileUrl, bearerToken, total);
        fileItem.blobUrl = fileUrl;
    }
    /**
     * Generate unique blob name
     */
    private generateBlobName(file: File): string {
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const guid = this.generateGuid().slice(0, 8);
        const extension = file.name.includes('.') ? file.name.split('.').pop() : '';

        return `${file.name.replace(/\.[^/.]+$/, "")}_${timestamp}_${guid}.${extension}`;
    }

    /**
     * Sanitize metadata key for HTTP header compatibility
     */
    private sanitizeMetadataKey(key: string): string {
        // Remove invalid characters and ensure it starts with a letter
        return key
            .replace(/[^a-zA-Z0-9-_]/g, '') // Keep only alphanumeric, dash, underscore
            .replace(/^[^a-zA-Z]/, 'X') // Ensure starts with letter
            .substring(0, 64); // Limit length
    }

    /**
     * Generate metadata for file
     */
    private generateMetadata(file: File): Record<string, string> {
        const metadata: Record<string, string> = {};

        // Use safe, hardcoded metadata property names to avoid header issues
        const userNameProperty = "UploadedBy";
        const timestampProperty = "UploadedAt";
        const emailProperty = "UserEmail";

        metadata["OriginalFileName"] = file.name;
        metadata["FileSize"] = file.size.toString();
        metadata["ContentType"] = file.type || "application/octet-stream";
        metadata[userNameProperty] = "PCF User"; // Can be enhanced with actual user info
        // time stamp should be in mmmddyyyy hh:mm:ss format
        const now = new Date();
        metadata[timestampProperty]= `${now.getMonth()+1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        metadata[emailProperty] = "user@example.com"; // Can be enhanced with actual user email

        return metadata;
    }

    /**
     * Handle cancel all action
     */
    private handleCancelAll(): void {
        this._isUploading = false;

        // Cancel all ongoing uploads
        for (const [fileId, fileItem] of this._files) {
            if (fileItem.status === 'uploading' && fileItem.xhr) {
                fileItem.xhr.abort();
                fileItem.status = 'pending';
                fileItem.progress = 0;
            }
        }

        this.updateFileList();
        this.updateActionButtons();
        this.showNotification("All uploads cancelled.", "warning");
    }

    /**
     * Retry upload for a specific file
     */
    private async retryUpload(fileId: string): Promise<void> {
        const fileItem = this._files.get(fileId);
        if (!fileItem || fileItem.status !== 'error') return;

        fileItem.retryCount = (fileItem.retryCount || 0) + 1;
        if (fileItem.retryCount > 3) {
            this.showNotification(`Maximum retry attempts exceeded for ${fileItem.file.name}.`, "error");
            return;
        }

        try {
            await this.uploadFile(fileItem);
        } catch (error) {
            // Error already handled in uploadFile
        }
    }

    /**
     * Remove file from the list
     */
    private removeFile(fileId: string): void {
        const fileItem = this._files.get(fileId);
        if (!fileItem) return;

        // Cancel upload if in progress
        if (fileItem.status === 'uploading' && fileItem.xhr) {
            fileItem.xhr.abort();
        }

        this._files.delete(fileId);
        this.updateFileList();
        this.updateActionButtons();
    }

    /**
     * Update specific file item in the list
     */
    private updateFileItem(fileId: string): void {
        const fileElement = this._fileList.querySelector(`[data-file-id="${fileId}"]`);
        const fileItem = this._files.get(fileId);

        if (fileElement && fileItem) {
            const newFileElement = this.createFileElement(fileItem);
            fileElement.replaceWith(newFileElement);
        }
    }

    /**
     * Update action buttons state
     */
    private updateActionButtons(): void {
        const pendingFiles = Array.from(this._files.values()).filter(f => f.status === 'pending');
        const uploadingFiles = Array.from(this._files.values()).filter(f => f.status === 'uploading');

        this._uploadAllButton.disabled = pendingFiles.length === 0 || this._isUploading;
        this._cancelAllButton.disabled = uploadingFiles.length === 0;
        this._cancelAllButton.style.display = this._isUploading ? "inline-flex" : "none";
    }

    /**
     * Check if all uploads are complete
     */
    private checkAllUploadsComplete(): void {
        const completedFiles = Array.from(this._files.values()).filter(f => f.status === 'success');
        const failedFiles = Array.from(this._files.values()).filter(f => f.status === 'error');
        const totalFiles = this._files.size;

        if (totalFiles > 0 && completedFiles.length + failedFiles.length === totalFiles) {
            if (failedFiles.length === 0) {
                this.showNotification(`Successfully uploaded ${completedFiles.length} file${completedFiles.length > 1 ? 's' : ''}!`, "success");
            } else {
                this.showNotification(`Upload complete: ${completedFiles.length} successful, ${failedFiles.length} failed.`, "warning");
            }
        }
    }

    /**
     * Show notification
     */
    private showNotification(message: string, type: 'success' | 'error' | 'warning', duration = 5000): void {
        const notificationId = this.generateGuid();
        const notification: NotificationItem = {
            id: notificationId,
            message,
            type,
            duration
        };

        this._notifications.push(notification);
        this.renderNotification(notification);

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notificationId);
            }, duration);
        }
    }

    /**
     * Render notification to DOM
     */
    private renderNotification(notification: NotificationItem): void {
        const notificationEl = document.createElement("div");
        notificationEl.className = `notification ${notification.type}`;
        notificationEl.setAttribute("data-notification-id", notification.id);
        notificationEl.setAttribute("role", "alert");

        const icon = document.createElement("span");
        icon.className = "notification-icon";
        icon.textContent = this.getNotificationIcon(notification.type);

        const content = document.createElement("div");
        content.className = "notification-content";
        content.textContent = notification.message;

        const closeBtn = document.createElement("button");
        closeBtn.className = "notification-close";
        closeBtn.innerHTML = "×";
        closeBtn.addEventListener("click", () => this.hideNotification(notification.id));

        notificationEl.appendChild(icon);
        notificationEl.appendChild(content);
        notificationEl.appendChild(closeBtn);

        this._notificationContainer.appendChild(notificationEl);
    }

    /**
     * Hide and remove notification
     */
    private hideNotification(notificationId: string): void {
        const notificationEl = this._notificationContainer.querySelector(`[data-notification-id="${notificationId}"]`);
        if (notificationEl) {
            notificationEl.classList.add("hiding");
            setTimeout(() => {
                notificationEl.remove();
            }, 300);
        }

        // Remove from notifications array
        this._notifications = this._notifications.filter(n => n.id !== notificationId);
    }

    /**
     * Utility methods
     */
    private generateFileId(): string {
        return `file_${this.generateGuid()}`;
    }

    private generateGuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private getFileIcon(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase() || "default";
        return this._fileIcons[extension] || this._fileIcons["default"];
    }

    private getStatusText(status: string): string {
        switch (status) {
            case 'pending': return 'Pending';
            case 'uploading': return 'Uploading...';
            case 'success': return 'Completed';
            case 'error': return 'Failed';
            default: return status;
        }
    }

    private getNotificationIcon(type: string): string {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'warning': return '⚠';
            default: return 'ℹ';
        }
    }

    private getAcceptedFileTypesString(): string {
        const acceptedType = this._context.parameters.acceptedFileTypes.raw || "All";
        if (acceptedType === "All") return "*";

        const extensions = this._acceptedTypes
            .filter(type => type.startsWith('.'))
            .join(',');
        return extensions || "*";
    }

    private getAcceptedFileTypesDescription(): string {
        const acceptedType = this._context.parameters.acceptedFileTypes.raw || "All";
        if (acceptedType === "All") {
            return "All file types allowed";
        }
        return `Accepted: ${acceptedType} files (Max: ${this.formatFileSize(this._maxFileSize)})`;
    }

    private getUploadHintText(): string {
        const multipleText = this._enableMultiple ? ` up to ${this._maxFileCount} files` : " a single file";
        return `Upload${multipleText} to Azure Blob Storage`;
    }

    /**
     * Ensure global styles are added to the document
     */
    private ensureGlobalStyles(): void {
        if (!document.getElementById('customFileUploadStyles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'customFileUploadStyles';
            styleEl.textContent = `
                /* Additional runtime styles if needed */
                .file-upload-container {
                    --notification-z-index: 9999;
                }
            `;
            document.head.appendChild(styleEl);
        }
    }

    /**
     * Update view when context changes
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;

        // Update configuration if properties changed
        this.initializeConfiguration();

        // Update UI elements that depend on configuration
        if (this._fileInput) {
            this._fileInput.multiple = this._enableMultiple;
            this._fileInput.accept = this.getAcceptedFileTypesString();
        }

        // Update header text
        const subtitle = this._mainContainer.querySelector('.upload-subtitle');
        if (subtitle) {
            subtitle.textContent = this.getUploadHintText();
        }

        // Update drop zone hint
        const hint = this._mainContainer.querySelector('.drop-zone-hint');
        if (hint) {
            hint.textContent = this.getAcceptedFileTypesDescription();
        }
    }

    /**
     * Get outputs for the control
     */
    public getOutputs(): IOutputs {
        const uploadedFiles = Array.from(this._files.values())
            .filter(f => f.status === 'success')
            .map(f => ({
                name: f.file.name,
                size: f.file.size,
                type: f.file.type,
                url: f.blobUrl,
                uploadedAt: new Date().toISOString()
            }));

        return {
            // Add output properties if needed
            // uploadedFiles: uploadedFiles
        } as IOutputs;
    }

    /**
     * Cleanup when control is destroyed
     */
    public destroy(): void {
        // Cancel all ongoing uploads
        this._isUploading = false;
        for (const [fileId, fileItem] of this._files) {
            if (fileItem.status === 'uploading' && fileItem.xhr) {
                fileItem.xhr.abort();
            }
        }

        // Clear notifications
        this._notifications.forEach(n => this.hideNotification(n.id));

        // Remove event listeners using bound handlers
        if (this._dropZone) {
            this._dropZone.removeEventListener("dragover", this._boundDragOverHandler);
            this._dropZone.removeEventListener("dragleave", this._boundDragLeaveHandler);
            this._dropZone.removeEventListener("drop", this._boundDropHandler);
            this._dropZone.removeEventListener("keydown", this._boundKeyDownHandler);
        }

        if (this._fileInput) {
            this._fileInput.removeEventListener("change", this._boundFileSelectedHandler);
        }

        if (this._uploadAllButton) {
            this._uploadAllButton.removeEventListener("click", this._boundUploadAllHandler);
        }

        if (this._cancelAllButton) {
            this._cancelAllButton.removeEventListener("click", this._boundCancelAllHandler);
        }

        // Clear references
        this._files.clear();
        this._notifications = [];
    }
}