# Azure Function for SAS Token Generation

This Azure Function generates short-lived SAS tokens for secure file uploads to Azure Blob Storage, eliminating the need to expose storage account keys in client-side applications.

## Features

- **Secure**: Generates short-lived SAS tokens (configurable duration, max 24 hours)
- **Flexible**: Supports different permission levels (read, write, delete, add)
- **Validated**: Includes blob name validation and size limits
- **CORS Enabled**: Cross-origin requests supported
- **Configurable**: Environment-based configuration

## Configuration

### Environment Variables

Set these in your Azure Function Application Settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `AzureStorageConnectionString` | Azure Storage connection string | `DefaultEndpointsProtocol=https;AccountName=mystorage;AccountKey=...` |
| `ContainerName` | Target container name | `uploads` |
| `MaxFileSizeMB` | Maximum file size in MB | `100` |
| `MaxFileCount` | Maximum files per request | `10` |
| `AllowedExtensions` | Comma-separated allowed file extensions | `.pdf,.doc,.docx,.jpg,.png` |

### Azure Storage Permissions

The storage account used must have the following:

1. **Container**: Create containers and manage access
2. **Blob**: Write, Read, Delete permissions on blobs

## API Usage

### Endpoint

```
GET/POST /api/GenerateSasToken
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blobName` | string | Yes | Target blob name (will be URL-encoded) |
| `permission` | string | No | Permission set (default: "rw") |
| `duration` | number | No | Token duration in seconds (default: 3600, max: 86400) |

### Permission Values

- `r` - Read
- `w` - Write
- `d` - Delete
- `a` - Add
- `c` - Create

Combine permissions: `rw` (read+write), `rwd` (read+write+delete)

### Request Examples

#### GET Request
```
GET /api/GenerateSasToken?blobName=document.pdf&permission=rw&duration=3600
```

#### POST Request
```json
POST /api/GenerateSasToken
Content-Type: application/json

{
  "blobName": "document.pdf",
  "permission": "rw",
  "duration": 3600
}
```

### Response Format

```json
{
  "uploadUrl": "https://mystorage.blob.core.windows.net/uploads/document_20231220_abc123.pdf?sv=2023-11-03&...&sig=...",
  "blobName": "document_20231220_abc123.pdf",
  "containerName": "uploads",
  "accountName": "mystorage",
  "expiresAt": "2023-12-20T15:30:00Z",
  "permissions": "rw",
  "duration": 3600
}
```

## Security Considerations

1. **Short-lived tokens**: Default 1-hour expiration, maximum 24 hours
2. **Least privilege**: Only request necessary permissions
3. **HTTPS only**: Always use HTTPS in production
4. **Container isolation**: Use dedicated containers for different purposes
5. **Monitoring**: Enable Azure Monitor for function logs
6. **IP restrictions**: Consider IP restrictions for the function

## Deployment

### Azure CLI

```bash
# Create function app
az functionapp create \
  --resource-group MyResourceGroup \
  --consumption-plan-location eastus \
  --runtime dotnet \
  --functions-version 4 \
  --name MySasTokenFunction \
  --storage-account mystorageaccount

# Configure app settings
az functionapp config appsettings set \
  --resource-group MyResourceGroup \
  --name MySasTokenFunction \
  --settings "AzureStorageConnectionString=your_connection_string" \
             "ContainerName=uploads"

# Deploy function
func azure functionapp publish MySasTokenFunction
```

### Local Development

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Run locally
func start
```

## Integration with PCF Control

Configure your PCF control with:

- **Upload Auth Mode**: `SASFromServer`
- **SAS Request URL**: `https://your-function-app.azurewebsites.net/api/GenerateSasToken`
- **Storage Account Name**: Your storage account name
- **Container Name**: Same as configured in function

## Error Handling

The function returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `401`: Unauthorized (invalid storage credentials)
- `500`: Internal server error

## Monitoring and Logging

Enable Application Insights for:

- Request tracking
- Performance monitoring
- Error analysis
- Usage analytics

## CORS Configuration

Update `host.json` to restrict origins in production:

```json
{
  "Host": {
    "CORS": ["https://your-domain.com"],
    "CORSCredentials": true
  }
}
```

## Rate Limiting

Consider implementing rate limiting using:

1. **Azure API Management**: For advanced throttling
2. **Azure Functions Premium**: With built-in rate limiting
3. **Custom middleware**: For simple rate limiting

## Cost Optimization

- Use **Consumption Plan** for sporadic usage
- Consider **Premium Plan** for high volume
- Monitor **Execution Units** and **Execution Time**
- Enable **Always On** only if needed

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check storage permissions and connection string
2. **400 Bad Request**: Validate blob name format
3. **500 Internal Error**: Check function logs and storage access

### Debugging

Enable detailed logging:

```json
{
  "logging": {
    "logLevel": {
      "default": "Information",
      "Microsoft": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
```