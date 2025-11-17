# Deployment Guide

This guide covers the complete deployment process for the modernized PCF File Upload Control.

## 📋 Prerequisites

- **Power Apps Component Framework CLI** installed
- **Azure Subscription** with Storage Account
- **Node.js 16+** and npm
- **Azure CLI** (for Azure Function deployment)

## 🚀 Quick Deployment Steps

### 1. Build the Control

```bash
# Install dependencies
npm install

# Build the control
npm run build

# Verify build output
ls -la out/controls/
```

### 2. Deploy Azure Function (Recommended)

```bash
# Navigate to Azure Function directory
cd azure-function

# Install dependencies
npm install

# Deploy to Azure
func azure functionapp publish YourFunctionAppName

# Verify deployment
curl https://YourFunctionAppName.azurewebsites.net/api/GenerateSasToken?blobName=test.txt
```

### 3. Import to Power Apps

1. **Package the control** (if needed)
2. **Import solution** to Power Apps
3. **Add control** to form or canvas app
4. **Configure properties** (see configuration section)

## 🔧 Configuration Details

### Azure Storage Setup

```bash
# Create storage account
az storage account create \
  --name mystorageaccount \
  --resource-group MyResourceGroup \
  --location eastus \
  --sku Standard_LRS

# Create container
az storage container create \
  --name uploads \
  --account-name mystorageaccount \
  --public-access off

# Get connection string (for Azure Function)
az storage account show-connection-string \
  --name mystorageaccount \
  --resource-group MyResourceGroup \
  --query connectionString
```

### Azure Function Configuration

```bash
# Set application settings
az functionapp config appsettings set \
  --name YourFunctionAppName \
  --resource-group MyResourceGroup \
  --settings \
    "AzureStorageConnectionString=your_connection_string" \
    "ContainerName=uploads" \
    "MaxFileSizeMB=100"
```

### CORS Configuration

```bash
# Configure CORS for Azure Storage
az storage cors add \
  --account-name mystorageaccount \
  --services b \
  --methods POST PUT \
  --origins "https://your-domain.com" \
  --max-age 86400
```

## 📱 Power Apps Configuration

### Canvas App Setup

1. **Add Media Control**
   - Insert → Media → Add custom control
   - Search for "PCF File Upload"
   - Add to screen

2. **Configure Properties**
   ```
   Storage Account Name: mystorageaccount
   Container Name: uploads
   Upload Auth Mode: SASFromServer
   SAS Request URL: https://your-function-app.azurewebsites.net/api/GenerateSasToken
   Max File Size (MB): 100
   Enable Multiple Files: Yes
   Accepted File Types: PDF, Image, Text
   ```

### Model-Driven App Setup

1. **Add Control to Form**
   - Open form editor
   - Add component → PCF File Upload
   - Configure properties same as above

## 🧩 OneLake (Microsoft Fabric) Configuration

### 1. Azure Function for AAD Token
- Add `GenerateOneLakeToken` to your function app (provided in `azure-function/GenerateOneLakeToken.cs`).
- Configure app settings:
  - `TenantId` = your AAD tenant ID
  - `ClientId` = service principal (app registration) client ID
  - `ClientSecret` = service principal secret
- The function returns a bearer token for scope `https://storage.azure.com/.default`.

### 2. PCF Properties
- Set in the control:
  - `uploadAuthMode`: `OneLakeAAD`
  - `oneLakeWorkspaceId`: `<fabric-workspace-guid>`
  - `oneLakeLakehouseId`: `<fabric-lakehouse-guid>`
  - `oneLakeBasePath`: `Files` (recommended)
  - `oneLakeUserSubPath`: optional per-user folder (e.g., `users/{username}`)
  - `oneLakeChunkSizeMB`: `8` (recommended)
  - `maxFileSizeMB`: `1024` (1GB)
  - `aadTokenRequestUrl`: `https://<functionapp>.azurewebsites.net/api/GenerateOneLakeToken`

### 3. OneLake Direct Token (Dev-only) Configuration
- Use when you already have a DFS folder URL and a Bearer token:
  - `uploadAuthMode`: `OneLakeDirectToken`
  - `oneLakeFolderUrl`: e.g. `https://onelake.dfs.fabric.microsoft.com/<workspace>/<lakehouse>/Files/test_powerapps`
  - `aadAccessToken`: a Bearer token for scope `https://storage.azure.com/.default`
  - Other limits: `oneLakeChunkSizeMB` and `maxFileSizeMB` as above
- Notes:
  - Tokens in client config are sensitive; use only in dev/internal scenarios.
  - If CORS blocks DFS calls, switch to `OneLakeAAD` or `ServerProxyUpload`.

### 3. OneLake REST (DFS) Notes
- Create: `PUT .../{path}?resource=file`
- Append: `PATCH .../{path}?action=append&position={offset}`
- Flush: `PATCH .../{path}?action=flush&position={length}`
- Headers: `Authorization: Bearer <token>`, `x-ms-version: 2023-11-03`

### 4. CORS Considerations
- If direct browser calls to `onelake.dfs.fabric.microsoft.com` are blocked by CORS, use `ServerProxyUpload` as a fallback.
- Keep token lifetime short; the control caches until ~2 minutes before expiry.

## 🔒 Security Configuration

### SAS Token Security

```typescript
// Azure Function - Generate secure SAS tokens
const sasToken = generateBlobSASQueryParameters({
  blobName: blobName,
  permissions: BlobSASPermissions.parse("cw"), // Create + Write
  expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
  protocol: SASProtocol.Https,
  version: "2023-11-03"
}, storageSharedKeyCredential);
```

### Network Security

```json
// Azure Function - host.json
{
  "Host": {
    "CORS": ["https://your-domain.com"],
    "CORSCredentials": true
  },
  "http": {
    "routePrefix": "api"
  }
}
```

## 🧪 Testing Checklist

### Functional Testing

- [ ] **File Upload**: Test various file types and sizes
- [ ] **Multiple Files**: Test batch uploads
- [ ] **Drag & Drop**: Test drag-and-drop functionality
- [ ] **Progress Tracking**: Verify real-time progress updates
- [ ] **Error Handling**: Test network failures and invalid files
- [ ] **Retry Logic**: Test retry mechanism for failed uploads
- [ ] **Cancel Upload**: Test cancellation functionality
- [ ] **Accessibility**: Test keyboard navigation and screen readers

### OneLake Testing
- [ ] **Create/Append/Flush**: Verify files appear in lakehouse under the expected path
- [ ] **Chunk Size**: Validate with 8MB, adjust if needed
- [ ] **Large Files**: Test 200MB and ~1GB uploads
- [ ] **Per-user Path**: Confirm dynamic subpath resolution
- [ ] **Token Expiry**: Validate refresh behavior near expiry

### Security Testing

- [ ] **Authentication**: Verify SAS token generation and usage
- [ ] **File Validation**: Test file type and size restrictions
- [ ] **CORS**: Test cross-origin request behavior
- [ ] **Rate Limiting**: Test upload frequency limits
- [ ] **Large Files**: Test chunked upload functionality

### Browser Compatibility

- [ ] **Chrome** (latest version)
- [ ] **Firefox** (latest version)
- [ ] **Safari** (latest version)
- [ ] **Edge** (latest version)
- [ ] **Mobile Chrome** (Android)
- [ ] **Mobile Safari** (iOS)

## 🐛 Troubleshooting

### Common Issues

#### 1. Build Failures
```
Error: TypeScript compilation failed
```
**Solution**: Check TypeScript errors and fix type issues

#### 2. SAS Token Generation Failed
```
Error: Failed to get SAS token: 401 Unauthorized
```
**Solution**: Verify Azure Function connection string and permissions

#### 3. Upload Failures
```
Error: Upload failed: 403 Forbidden
```
**Solution**: Check SAS token expiration and storage permissions

#### 4. CORS Errors
```
Error: CORS policy: No 'Access-Control-Allow-Origin'
```
**Solution**: Configure CORS on Azure Storage and Function

### Debug Mode

Enable debug logging in the control:

```typescript
// In index.ts
private DEBUG_MODE = true;

private log(message: string, data?: any): void {
  if (this.DEBUG_MODE) {
    console.log(`[PCF File Upload] ${message}`, data);
  }
}
```

## 📊 Monitoring

### Azure Monitor Setup

```bash
# Enable Application Insights
az monitor app-insights component create \
  --app MyFileUploadMonitor \
  --location eastus \
  --resource-group MyResourceGroup

# Configure logging
az monitor diagnostic-settings create \
  --resource $(az storage account show -n mystorageaccount --query id -o tsv) \
  --name storage-diagnostics \
  --workspace $(az monitor log-analytics workspace show -n myworkspace -g myrg --query customerId -o tsv) \
  --logs '[{"category": "StorageRead","enabled": true},{"category": "StorageWrite","enabled": true}]'
```

### Key Metrics to Monitor

- **Upload success rate**
- **Average upload time**
- **Error frequency**
- **Storage usage**
- **Function execution time**

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Build control
        run: npm run build

      - name: Deploy Azure Function
        run: |
          cd azure-function
          func azure functionapp publish ${{ secrets.AZURE_FUNCTION_NAME }}
```

## 📝 Environment Variables

### Development Environment

```bash
# .env.local
AZURE_STORAGE_CONNECTION_STRING="your_dev_connection_string"
AZURE_FUNCTION_URL="https://dev-function-app.azurewebsites.net"
DEBUG_MODE=true
```

### Production Environment

```bash
# Application Settings
AZURE_STORAGE_CONNECTION_STRING="your_prod_connection_string"
AZURE_FUNCTION_URL="https://prod-function-app.azurewebsites.net"
DEBUG_MODE=false
MAX_FILE_SIZE_MB=100
ENABLE_MULTIPLE_FILES=true
```

## 🎯 Performance Optimization

### Bundle Optimization

```javascript
// webpack.config.js (if customizing)
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxSize: 244 * 1024, // 244KB
    },
  },
};
```

### Caching Strategy

```typescript
// Cache SAS tokens for 5 minutes
private sasTokenCache = new Map<string, { token: string, expires: number }>();

private async getCachedSasToken(blobName: string): Promise<string> {
  const cacheKey = blobName;
  const cached = this.sasTokenCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.token;
  }

  const token = await this.getSASUrlFromServer(blobName);
  this.sasTokenCache.set(cacheKey, {
    token,
    expires: Date.now() + 5 * 60 * 1000 // 5 minutes
  });

  return token;
}
```

## 📚 Additional Resources

- [Power Apps Component Framework Documentation](https://docs.microsoft.com/en-us/power-apps/developer/component-framework)
- [Azure Storage Security Best Practices](https://docs.microsoft.com/en-us/azure/storage/common/storage-security-guide)
- [Azure Functions Scaling](https://docs.microsoft.com/en-us/azure/azure-functions/functions-scale)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

For additional support, see the main README.md or create an issue in the repository.