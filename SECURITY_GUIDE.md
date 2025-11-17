# Security Guide for PCF File Upload Control

This guide outlines the security best practices and considerations for the modernized PCF File Upload Control.

## Security Overview

The updated control eliminates security vulnerabilities by:

1. **Removing client-side credentials**: No more connection strings or account keys in the manifest
2. **Implementing SAS token authentication**: Short-lived, minimal-permission tokens
3. **Adding server-side validation**: File type, size, and content validation
4. **Secure upload flows**: Multiple authentication options with different security profiles

## Authentication Modes Comparison

### 1. SAS Token from Server (Recommended) 🛡️

**Security Level**: High

**How it works**:
- PCF control requests SAS token from your server
- Server generates short-lived token with minimal permissions
- Control uploads directly to Azure Blob Storage using the token

**Pros**:
- No credentials stored in client-side code
- Token expiration (typically 1 hour)
- Minimal permissions (write-only for specific blob)
- Server can validate user permissions before issuing token

**Cons**:
- Requires server-side component
- Additional network request for token generation

**Implementation Requirements**:
- Azure Function or API endpoint
- Server-side storage account credentials
- User authentication/authorization logic

### 2. Direct SAS Token

**Security Level**: Medium

**How it works**:
- Pre-generated SAS token provided in manifest
- Control uploads directly using the token

**Pros**:
- Simple implementation
- No server-side component needed

**Cons**:
- Long-lived tokens (security risk)
- Token embedded in manifest configuration
- No dynamic permission validation

**Use Cases**:
- Development/testing environments
- Internal applications with controlled access

### 3. Server Proxy Upload

**Security Level**: High

**How it works**:
- Files uploaded to your server endpoint
- Server handles upload to Azure Blob Storage
- Client never interacts directly with Azure

**Pros**:
- Maximum control over file processing
- Can implement virus scanning, content analysis
- No Azure credentials exposed to client

**Cons**:
- Higher server resource usage
- Bandwidth passes through your server
- More complex server implementation

## Security Best Practices

### 1. SAS Token Security

```typescript
// ✅ Good: Short-lived, specific permissions
const sasToken = await getSasToken(blobName, {
  permissions: 'cw', // Create + Write only
  duration: 3600,    // 1 hour
  startTime: new Date(),
  expiryTime: new Date(Date.now() + 3600 * 1000)
});

// ❌ Bad: Long-lived, broad permissions
const sasToken = "sv=2020-08-04&ss=b&srt=sco&sp=rwdlacx&se=2030-12-31T23:59:59Z&...";
```

### 2. Container Security

```bash
# ✅ Good: Dedicated container with limited access
az storage container create \
  --name "user-uploads" \
  --account-name "mystorageaccount" \
  --public-access off \
  --metadata "purpose=user-uploads" "access-level=restricted"

# Set container-level policies
az storage container policy create \
  --container-name "user-uploads" \
  --name "upload-policy" \
  --permissions cw \
  --expiry $(date -d "+1 hour" --iso-8601) \
  --start $(date --iso-8601)
```

### 3. Network Security

```json
// ✅ Good: Restrict to specific origins
{
  "Host": {
    "CORS": ["https://your-domain.com", "https://app.powerapps.com"],
    "CORSCredentials": true
  }
}

// ✅ Good: Private endpoint with firewall rules
{
  "properties": {
    "networkAcls": {
      "bypass": "AzureServices",
      "defaultAction": "Deny",
      "ipRules": [
        {
          "value": "203.0.113.0/24",
          "action": "Allow"
        }
      ],
      "virtualNetworkRules": []
    }
  }
}
```

### 4. Azure Storage Security

#### Access Keys Management

```bash
# ✅ Good: Regular key rotation
az storage account keys renew \
  --account-name "mystorageaccount" \
  --key primary

# ✅ Good: Use managed identities
az identity create \
  --resource-group "MyResourceGroup" \
  --name "file-upload-identity"

# Assign storage role
az role assignment create \
  --assignee "$(az identity show --name file-upload-identity --query principalId -o tsv)" \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/<subscription>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/mystorageaccount"
```

#### Encryption Settings

```bash
# ✅ Good: Customer-managed encryption
az storage account encryption create \
  --account-name "mystorageaccount" \
  --encryption-key-name "mykey" \
  --encryption-key-vault "mykeyvault" \
  --encryption-key-version "latest"
```

## File Validation Security

### 1. Client-Side Validation (First Line of Defense)

```typescript
private validateFile(file: File): boolean {
  // File size validation
  if (file.size > this._maxFileSize) {
    throw new Error(`File size exceeds limit of ${this.formatFileSize(this._maxFileSize)}`);
  }

  // File type validation
  if (!this.isFileTypeValid(file)) {
    throw new Error(`File type ${file.type} is not allowed`);
  }

  // File name validation
  if (this.containsMaliciousPatterns(file.name)) {
    throw new Error(`File name contains invalid characters`);
  }

  return true;
}

private containsMaliciousPatterns(fileName: string): boolean {
  const maliciousPatterns = [
    /\.\./,  // Directory traversal
    /[<>:"|?*]/,  // Invalid characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Reserved names
    /\.exe$/i,  // Executable files
    /\.bat$/i,  // Batch files
    /\.cmd$/i,  // Command files
    /\.scr$/i,  // Screensaver files
  ];

  return maliciousPatterns.some(pattern => pattern.test(fileName));
}
```

### 2. Server-Side Validation (Essential)

```csharp
// Azure Function validation
private bool ValidateFileUpload(string blobName, long fileSize, string contentType)
{
    // Size validation
    if (fileSize > MaxFileSizeBytes)
        return false;

    // Content type validation
    var allowedTypes = new[] { "application/pdf", "image/jpeg", "image/png" };
    if (!allowedTypes.Contains(contentType.ToLower()))
        return false;

    // Blob name validation
    if (!BlobNameValidator.IsValidBlobName(blobName))
        return false;

    // Rate limiting
    if (IsRateLimited())
        return false;

    return true;
}
```

## Monitoring and Logging

### 1. Azure Monitor Setup

```bash
# Enable diagnostic settings
az monitor diagnostic-settings create \
  --name "storage-diagnostics" \
  --resource "$(az storage account show -n mystorageaccount --query id -o tsv)" \
  --workspace "$(az monitor log-analytics workspace show -n myworkspace -g myrg --query customerId -o tsv)" \
  --logs '[{"category": "StorageRead","enabled": true},{"category": "StorageWrite","enabled": true}]' \
  --metrics '[{"category": "Transaction","enabled": true}]'
```

### 2. Security Event Logging

```typescript
private logSecurityEvent(event: string, details: any): void {
  const securityEvent = {
    timestamp: new Date().toISOString(),
    event: event,
    userId: this.getCurrentUserId(),
    details: details,
    ipAddress: this.getClientIP(),
    userAgent: navigator.userAgent
  };

  // Send to security monitoring service
  this.sendSecurityEvent(securityEvent);
}
```

## Compliance Considerations

### 1. Data Privacy (GDPR/CCPA)

```typescript
private sanitizeMetadata(file: File): Record<string, string> {
  return {
    "OriginalFileName": this.hashSensitiveData(file.name),
    "FileSize": file.size.toString(),
    "ContentType": file.type,
    "UploadedBy": this.getUserId(), // Use anonymized ID
    "UploadedAt": new Date().toISOString(),
    "UserEmail": this.maskEmail(this.getUserEmail()) // Mask PII
  };
}

private maskEmail(email: string): string {
  const [username, domain] = email.split('@');
  const maskedUsername = username.substring(0, 2) + '***';
  return `${maskedUsername}@${domain}`;
}
```

### 2. Data Residency

```typescript
private getRegionalStorageEndpoint(): string {
  const userRegion = this.getUserRegion();

  // Map regions to storage endpoints
  const regionMap: Record<string, string> = {
    'EU': 'eus2',  // East US 2
    'US': 'eus2',  // East US 2
    'APAC': 'apse' // Asia Pacific Southeast
  };

  const storageRegion = regionMap[userRegion] || 'eus2';
  return `https://${storageRegion}.blob.core.windows.net`;
}
```

## Incident Response

### 1. Security Incident Detection

```typescript
private detectSuspiciousActivity(fileItem: FileUploadItem): boolean {
  // Multiple failed uploads from same user
  const failedUploads = this.getRecentFailedUploads(this.getUserId());
  if (failedUploads.length > 5) {
    this.reportSuspiciousActivity('Multiple failed uploads', { userId: this.getUserId() });
    return true;
  }

  // Unusual file size patterns
  if (fileItem.file.size > this._maxFileSize * 0.9) {
    this.logSecurityEvent('Large file upload', {
      fileSize: fileItem.file.size,
      fileName: fileItem.file.name
    });
  }

  // Rapid file uploads (potential automation)
  const uploadCount = this.getRecentUploadCount(this.getUserId(), 60000); // Last minute
  if (uploadCount > 10) {
    this.reportSuspiciousActivity('Rapid file uploads', {
      userId: this.getUserId(),
      uploadCount
    });
    return true;
  }

  return false;
}
```

### 2. Automated Response

```typescript
private handleSecurityIncident(incident: SecurityIncident): void {
  switch (incident.severity) {
    case 'HIGH':
      // Block user temporarily
      this.blockUser(incident.userId, 3600000); // 1 hour
      this.notifySecurityTeam(incident);
      this.cancelAllUploads(incident.userId);
      break;

    case 'MEDIUM':
      // Require additional authentication
      this.requireReauth(incident.userId);
      this.logSecurityEvent(incident.type, incident.details);
      break;

    case 'LOW':
      // Log and monitor
      this.logSecurityEvent(incident.type, incident.details);
      this.increaseMonitoring(incident.userId);
      break;
  }
}
```

## Testing Security

### 1. Security Test Cases

```typescript
describe('File Upload Security', () => {
  test('should reject executable files', async () => {
    const maliciousFile = new File(['malicious content'], 'virus.exe', {
      type: 'application/x-executable'
    });

    expect(() => component.validateFile(maliciousFile))
      .toThrow('File type is not allowed');
  });

  test('should reject files with path traversal', async () => {
    const maliciousFile = new File(['content'], '../../../etc/passwd', {
      type: 'text/plain'
    });

    expect(component.containsMaliciousPatterns(maliciousFile.name))
      .toBe(true);
  });

  test('should enforce rate limiting', async () => {
    // Simulate rapid uploads
    for (let i = 0; i < 15; i++) {
      await component.handleFileUpload(mockFile);
    }

    expect(component.isRateLimited()).toBe(true);
  });
});
```

### 2. Penetration Testing Checklist

- [ ] Test with malicious file types
- [ ] Test path traversal attempts
- [ ] Test oversized file uploads
- [ ] Test rapid upload attempts (DoS)
- [ ] Test expired SAS token usage
- [ ] Test cross-origin attacks
- [ ] Test man-in-the-middle scenarios
- [ ] Test credential exposure

## Configuration Security

### 1. Secure Configuration

```json
{
  "properties": {
    "storageAccountName": "mystorageaccount",
    "containerName": "user-uploads",
    "uploadAuthMode": "SASFromServer",
    "sasRequestUrl": "https://secure-api.company.com/api/sas",
    "maxFileSizeMB": 100,
    "enableMultiple": true,
    "maxFileCount": 5,
    "acceptedFileTypes": "PDF",
    "enableMetadata": true
  }
}
```

### 2. Environment-Specific Settings

```typescript
// Development
if (environment === 'development') {
  this._sasRequestUrl = "https://localhost:7071/api/GenerateSasToken";
  this._maxFileSize = 10 * 1024 * 1024; // 10MB
}

// Production
if (environment === 'production') {
  this._sasRequestUrl = "https://secure-api.company.com/api/sas";
  this._maxFileSize = 100 * 1024 * 1024; // 100MB
  this._enableChunkedUpload = true;
}
```

## Security Checklist

### Before Deployment

- [ ] Remove all connection strings from manifest
- [ ] Implement SAS token authentication
- [ ] Set up server-side validation
- [ ] Configure CORS restrictions
- [ ] Enable logging and monitoring
- [ ] Test security scenarios
- [ ] Review file type restrictions
- [ ] Set up rate limiting
- [ ] Configure storage security
- [ ] Document security procedures

### Ongoing Monitoring

- [ ] Monitor upload patterns
- [ ] Review security logs
- [ ] Update allowed file types
- [ ] Rotate SAS tokens regularly
- [ ] Monitor storage access
- [ ] Update security patches
- [ ] Conduct regular security audits
- [ ] Test backup and recovery procedures

By following these security guidelines, you can ensure your PCF File Upload Control maintains a strong security posture while providing excellent user experience.