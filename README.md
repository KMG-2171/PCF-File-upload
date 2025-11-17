# Modern PCF File Upload Control

A comprehensive, secure, and feature-rich Power Apps Component Framework (PCF) control for file uploads to Azure Blob Storage with modern UI, drag-and-drop support, and enterprise-grade security.

## ✨ Features

### 🎨 Modern User Interface
- **Clean, card-based design** with smooth animations and micro-interactions
- **Drag-and-drop zone** with visual feedback
- **Real-time progress tracking** with animated progress bars
- **Responsive design** that works on desktop and mobile
- **Accessibility compliant** with ARIA labels and keyboard navigation
- **Dark/light mode support** through CSS variables

### 🔐 Enterprise Security
- **No client-side credentials** - eliminates connection string exposure
- **SAS token authentication** with short-lived, minimal-permission tokens
- **Multiple auth modes**: SAS from server, direct SAS, or server proxy
- **File validation** with type and size restrictions
- **Rate limiting** and abuse protection
- **CORS configuration** for cross-origin security

### 📁 Advanced File Management
- **Multi-file support** with configurable limits
- **File preview** with type-specific icons
- **Retry mechanism** for failed uploads (up to 3 attempts)
- **Cancel functionality** for in-progress uploads
- **Duplicate detection** and prevention
- **Chunked uploads** for large files (>50MB)

### 📊 Progress & Feedback
- **Real upload progress** using XMLHttpRequest
- **Status indicators** (pending, uploading, success, error)
- **Toast notifications** with auto-dismiss
- **Error messages** with actionable information
- **Success confirmations** with file details

### ⚙️ Configuration Options
- **File type restrictions** with customizable accepted types
- **File size limits** with configurable maximums
- **Upload modes** (single vs multiple files)
- **Metadata collection** with custom property mapping
- **Chunked upload** configuration
- **Authentication mode** selection

## 🚀 Quick Start

### 1. Prerequisites
- Power Apps Component Framework CLI
- Azure Storage Account
- Azure Function (for SAS token generation - recommended)
- Node.js 16+ and npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Control
```bash
npm run build
```

### 4. Deploy Azure Function (Optional but Recommended)
```bash
cd azure-function
func azure functionapp publish YourFunctionAppName
```

### 5. Configure in Power Apps
1. Import the solution containing the PCF control
2. Add the control to a form or canvas app
3. Configure the required properties:
   - **Storage Account Name**: Your Azure Storage account name
   - **Container Name**: Target blob container
   - **Upload Auth Mode**: `SASFromServer` (recommended)
   - **SAS Request URL**: Your Azure Function endpoint

## 📋 Configuration Guide

### Authentication Modes

#### 1. SAS from Server (Recommended) 🛡️
```
Upload Auth Mode: SASFromServer
SAS Request URL: https://your-function-app.azurewebsites.net/api/GenerateSasToken
```

#### 2. Direct SAS Token (Development Only)
```
Upload Auth Mode: DirectSASToken
SAS Token: sv=2023-11-03&ss=b&srt=sco&sp=cw&se=2024-01-01T00:00:00Z&...
```

#### 3. Server Proxy Upload
```
Upload Auth Mode: ServerProxyUpload
Upload Endpoint: https://your-api.com/upload
```

### File Configuration

```
Accepted File Types: PDF, Image, Text
Max File Size (MB): 100
Enable Multiple Files: Yes
Max File Count: 10
Enable Chunked Upload: Yes
Chunk Size (MB): 10
```

### Metadata Configuration

```
Enable Metadata: Yes
User Name Property: UploadedBy
Timestamp Property: UploadedAt
User Email Property: EmailID
```

## 🏗️ Architecture

### Component Structure
```
customFileUpload/
├── index.ts                 # Main control implementation
├── ControlManifest.Input.xml # Control properties and metadata
├── css/
│   └── customFileUpload.css  # Modern styling with CSS variables
└── generated/
    └── ManifestTypes.ts      # Auto-generated TypeScript types
```

### Key Classes and Interfaces
- `customFileUpload`: Main control class
- `FileUploadItem`: File upload state management
- `SASResponse`: SAS token response interface
- `NotificationItem`: Toast notification interface

### Security Flow
1. User selects files → Client validates
2. Request SAS token → Server validates user permissions
3. Receive short-lived SAS → Direct upload to Azure
4. Progress tracking → Real-time feedback
5. Success/Error handling → User notifications

### OneLake (Microsoft Fabric) Support
- New upload mode: OneLake via AAD bearer token (client credentials, short‑lived)
- Direct upload using ADLS Gen2 DFS API (create → append → flush)
- Dynamic per-user subpaths supported
- Chunked uploads (default 8MB) up to 1GB

## 🔧 Development

### Local Development
```bash
# Start development server
npm run start

# Start with watch mode
npm run start:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing
```bash
# Run tests (when implemented)
npm test

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

### Code Structure
- **Event handlers** bound once to prevent memory leaks
- **CSS classes** instead of inline styles
- **TypeScript interfaces** for type safety
- **Async/await** for readable asynchronous code
- **Error boundaries** for graceful error handling

## 📁 Azure Function Setup

### 1. Create Azure Function
```bash
func init FileUploadSasGenerator --dotnet
func new --name GenerateSasToken --template "Http trigger"
```

### 2. Configure Settings
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureStorageConnectionString": "YourConnectionString",
    "ContainerName": "uploads",
    "MaxFileSizeMB": "100",
    "MaxFileCount": "10"
  }
}
```

### 3. Deploy
```bash
func azure functionapp publish YourFunctionAppName
```

### OneLake Token Function
Add a function that returns a short‑lived AAD access token for scope `https://storage.azure.com/.default`:
- Function name: `GenerateOneLakeToken`
- App settings required: `TenantId`, `ClientId`, `ClientSecret`
- Response shape:
```json
{ "accessToken": "<JWT>", "expiresAt": "2025-01-01T10:00:00Z" }
```

## 🔒 Security Best Practices

### ✅ Do's
- Use SAS tokens with short expiration (1 hour or less)
- Implement server-side file validation
- Enable Azure Monitor logging
- Use HTTPS for all communications
- Restrict CORS origins
- Implement rate limiting
- Regular security audits

### ❌ Don'ts
- Store connection strings in client-side code
- Use long-lived SAS tokens
- Skip file type validation
- Ignore error logging
- Disable CORS restrictions
- Allow unlimited file sizes

## 🎯 Browser Support

- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+
- **Mobile browsers** (iOS Safari 14+, Android Chrome 90+)

## 📱 Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 480px) { ... }

/* Tablet */
@media (max-width: 768px) { ... }

/* Desktop */
@media (min-width: 769px) { ... }
```

## 🎨 Theming

The control uses CSS variables for easy theming:

```css
:root {
  --primary-color: #0078d4;
  --success-color: #28a745;
  --error-color: #dc3545;
  --border-radius-md: 12px;
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12);
}
```

## 📈 Performance

### Optimizations
- **Lazy loading** of file list items
- **Event delegation** for dynamic content
- **Memory management** with proper cleanup
- **Efficient DOM updates** with minimal reflows
- **Chunked uploads** for large files

### Bundle Size
- **Minified**: ~45KB
- **Gzipped**: ~15KB
- **Tree-shakable**: Unused code removed

## 🐛 Troubleshooting

### Common Issues

#### 1. Upload Fails with 403 Forbidden
**Cause**: Invalid or expired SAS token
**Solution**: Check Azure Function and storage permissions

#### 2. Files Not Appearing in List
**Cause**: JavaScript error or CSS issue
**Solution**: Check browser console for errors

#### 3. CORS Errors
**Cause**: Missing CORS configuration
**Solution**: Configure CORS on Azure Storage and Function

#### 4. Large File Uploads Fail
**Cause**: Request timeout or size limits
**Solution**: Enable chunked uploads

### Debug Mode
Enable debug logging by setting:
```typescript
private DEBUG_MODE = true;
```

## 📚 API Reference

### Properties
| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `storageAccountName` | string | ✅ | - | Azure Storage account name |
| `containerName` | string | ✅ | - | Target container name |
| `uploadAuthMode` | enum | ✅ | SASFromServer | Authentication mode |
| `sasRequestUrl` | string | ❌ | - | SAS token endpoint |
| `maxFileSizeMB` | number | ❌ | 100 | Maximum file size |
| `enableMultiple` | boolean | ❌ | false | Allow multiple files |
| `oneLakeWorkspaceId` | string | ✅ for OneLake | - | Fabric workspace ID (GUID) |
| `oneLakeLakehouseId` | string | ✅ for OneLake | - | Fabric lakehouse ID (GUID) |
| `oneLakeBasePath` | string | ❌ | Files | Root path inside lakehouse |
| `oneLakeUserSubPath` | string | ❌ | - | Per-user subfolder (optional) |
| `oneLakeChunkSizeMB` | number | ❌ | 8 | DFS append chunk size |
| `aadTokenRequestUrl` | string | ✅ for OneLake | - | Endpoint to fetch AAD token |
| `oneLakeFolderUrl` | string | ✅ for OneLakeDirectToken | - | DFS base folder URL |
| `aadAccessToken` | string | ✅ for OneLakeDirectToken | - | Bearer token (dev only) |

### Methods
```typescript
// Public methods (if exposed)
public uploadFiles(files: File[]): Promise<void>
public cancelAllUploads(): void
public clearFileList(): void
```

### Events
```typescript
// Custom events (if implemented)
onUploadComplete: (files: UploadedFile[]) => void
onUploadError: (error: UploadError) => void
onProgressUpdate: (progress: UploadProgress) => void
```

## 🔄 Migration from Old Version

### Breaking Changes
- Connection string property removed
- New authentication modes added
- CSS classes changed (update custom styles)
- Event handling improved (memory leak fixes)

### Migration Steps
1. Update manifest properties
2. Deploy Azure Function for SAS tokens
3. Update CSS customizations
4. Test authentication flow
5. Update error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use ESLint configuration
- Add accessibility attributes
- Test on multiple browsers
- Document new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting guide
- Review the security documentation
- Contact the development team

## 🗺️ Roadmap

### Version 0.2.0 (Planned)
- [ ] Image preview thumbnails
- [ ] Folder upload support
- [ ] Virus scanning integration
- [ ] Advanced file validation
- [ ] Upload pause/resume

### Version 0.3.0 (Future)
- [ ] Multi-language support
- [ ] Custom progress themes
- [ ] Advanced analytics
- [ ] Bulk operations
- [ ] Cloud provider support (AWS, GCP)

---

**Built with ❤️ for the Power Apps community**