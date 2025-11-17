# PCF File Upload Component Documentation

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites and Requirements](#prerequisites-and-requirements)
3. [Component Configuration](#component-configuration)
4. [Implementation Details](#implementation-details)
5. [Authentication Methods](#authentication-methods)
6. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
7. [Troubleshooting](#troubleshooting)
8. [Metadata Features](#metadata-features)
9. [Code Examples](#code-examples)
10. [Security Considerations](#security-considerations)

## Overview

The PCF File Upload Component is a Power Apps Component Framework (PCF) control that enables users to upload files directly to Azure Blob Storage from within Power Apps, Model-driven apps, and Canvas apps. The component provides a seamless file upload experience with support for various authentication methods, including SAS token-based authentication.

### Key Features
- **Modern, Rich UI/UX**: Professional card-based design with smooth animations and transitions
- **File Type Validation**: Configurable file type restrictions (PDF, CSV, Word, Excel, PowerPoint, Images, Text)
- **Interactive File Display**: Shows selected file with appropriate icon, name, and size
- **Close/Delete Option**: Users can deselect files without uploading
- **Progress Tracking**: Visual progress bar during upload
- **Direct Upload to Azure Blob Storage**: Secure file transfer using SAS tokens
- **Configurable Azure Settings**: Storage account name, connection string, and container name
- **Metadata Collection**: Automatically captures user information and upload timestamp
- **Customizable Metadata**: Configure property names and add additional metadata
- **Comprehensive Error Handling**: User-friendly error messages with icons

## Prerequisites and Requirements

### Development Environment
- **Power Apps CLI** - For building and deploying PCF controls
- **Visual Studio Code** - Recommended for development
- **Node.js** - Required for PCF development (version 14 or later)
- **TypeScript** - The component is written in TypeScript

### Azure Requirements
- **Azure Storage Account** - To store uploaded files
- **Azure Blob Container** - A container within the storage account
- **SAS Token or Connection String** - For authentication

### Power Platform Requirements
- **Power Apps or Dynamics 365 environment** - To host the component
- **Appropriate permissions** - To import and use custom controls

## Component Configuration

### Input Properties

The PCF File Upload Component requires the following input properties to be configured:

| Property Name | Display Name | Data Type | Required | Description |
|---------------|--------------|-----------|----------|-------------|
| `storageAccountName` | Storage Account Name | Single Line Text | Yes | The name of your Azure Storage Account |
| `connectionString` | Connection String | Multiple Lines Text | Yes | Azure Storage connection string or SAS token |
| `containerName` | Container Name | Single Line Text | Yes | The name of the Azure Blob Container |
| `acceptedFileTypes` | Accepted File Types | Enum | No | Allowed file types (PDF, CSV, Word, Excel, PowerPoint, Image, Text, All) |
| `enableMetadata` | Enable Metadata | Two Options | No | Enable metadata collection for uploaded files (default: true) |
| `userNameProperty` | User Name Property | Single Line Text | No | Metadata property name for user information (default: "UploadedBy") |
| `timestampProperty` | Timestamp Property | Single Line Text | No | Metadata property name for upload timestamp (default: "UploadedAt") |
| `additionalMetadata` | Additional Metadata | Multiple Lines Text | No | Additional metadata in JSON format |

### External Service Usage

The component requires external service access to Azure Blob Storage:
- **Domain**: `*.blob.core.windows.net`
- **Usage**: Required in the control manifest for proper connectivity

## Implementation Details

### Architecture

The component follows a clean architecture with separation of concerns:

1. **UI Layer**: Manages the user interface elements (button, notifications)
2. **Business Logic**: Handles file operations and authentication
3. **Service Layer**: Interacts with Azure Blob Storage REST API

### File Structure

```
customFileUpload/
├── ControlManifest.Input.xml    # Control manifest defining properties and resources
├── index.ts                     # Main component implementation
├── css/
│   └── customFileUpload.css     # Styling for the component
├── generated/
│   └── ManifestTypes.d.ts       # TypeScript definitions for manifest
```

### Key Components

#### UI Elements
- **Title Section**: "File Upload" heading with modern styling
- **File Display Card**:
  - Shows selected file with appropriate icon based on file type
  - Displays file name and formatted file size
  - Close/delete button to deselect files
  - Visual feedback for validation states
- **Action Buttons**:
  - **Browse Files**: Opens file selector with folder icon
  - **Upload to Cloud**: Initiates upload (enabled only when file is selected)
- **Progress Bar**: Animated progress indicator during upload
- **Notification Area**: Success/error messages with icons
- **Hidden File Input**: HTML input element for file selection

#### Core Methods
- [`init()`](customFileUpload/index.ts:24): Initializes the control and creates UI elements
- [`createUIElements()`](customFileUpload/index.ts:40): Creates the modern UI with card design
- [`onFileSelected()`](customFileUpload/index.ts:240): Handles file selection and validation
- [`isFileTypeValid()`](customFileUpload/index.ts:290): Validates file type against configuration
- [`updateFileDisplay()`](customFileUpload/index.ts:274): Updates the file display with name and size
- [`updateFileIcon()`](customFileUpload/index.ts:285): Updates the icon based on file extension
- [`onCloseButtonClick()`](customFileUpload/index.ts:115): Handles file deselection
- [`uploadFile()`](customFileUpload/index.ts:315): Handles the file upload process
- [`generateMetadata()`](customFileUpload/index.ts:540): Generates metadata for the uploaded file
- [`getCurrentUser()`](customFileUpload/index.ts:585): Retrieves current user from Power Apps context
- [`uploadToAzureBlob()`](customFileUpload/index.ts:390): Interacts with Azure Blob Storage REST API with metadata
- [`parseSasTokenFromConnectionString()`](customFileUpload/index.ts:445): Extracts SAS tokens from connection strings

## Authentication Methods

The component supports multiple authentication methods for Azure Blob Storage:

### 1. SAS Token (Shared Access Signature) - Recommended

SAS tokens provide secure, time-limited access to Azure Storage resources without exposing account keys.

#### Raw SAS Token
If your connection string contains only the SAS token (starts with `sv=`):
```
sv=2022-11-02&ss=b&srt=sco&sp=rwdlacx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=example_signature
```

#### Connection String with SAS Token
If your connection string contains a SAS token along with other parameters:
```
BlobEndpoint=https://youraccount.blob.core.windows.net/;SharedAccessSignature=sv=2022-11-02&ss=b&srt=sco&sp=rwdlacx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=example_signature
```

### 2. Account Key Authentication (Not Recommended for Production)

The component can parse connection strings with account keys, but this is not recommended for production environments due to security concerns.

### Implementation Details for SAS Token Handling

The component includes robust SAS token parsing logic:

```typescript
// Check if connection string is a raw SAS token
if (connectionString.startsWith("sv=")) {
    urlWithSas = `${blobUrl}?${connectionString}`;
} else {
    // Extract SAS token from connection string
    const sasToken = this.parseSasTokenFromConnectionString(connectionString);
    if (sasToken) {
        urlWithSas = `${blobUrl}?${sasToken}`;
    }
}
```

## Metadata Features

The PCF File Upload Component includes comprehensive metadata collection capabilities that automatically capture information about uploaded files and store them as blob metadata in Azure Blob Storage.

### Metadata Collection

#### Automatic Metadata
When metadata collection is enabled (default: true), the component automatically captures:

1. **User Information**: The name of the current Power Apps user
2. **Upload Timestamp**: ISO 8601 formatted timestamp when the file was uploaded
3. **File Information**: Original filename, file size, and MIME type

#### Configurable Metadata

You can customize the metadata properties through the component configuration:

- **User Name Property**: Change the metadata key for user information (default: "UploadedBy")
- **Timestamp Property**: Change the metadata key for timestamp (default: "UploadedAt")
- **Additional Metadata**: Add custom metadata in JSON format

#### Metadata Storage

Metadata is stored as blob metadata in Azure Blob Storage using the `x-ms-meta-*` headers. This metadata can be viewed in Azure Storage Explorer or accessed programmatically.

### Metadata Example

When a file is uploaded with default settings, the following metadata is stored:

```
x-ms-meta-UploadedBy: john.doe@company.com
x-ms-meta-UploadedAt: 2024-01-10T15:30:45.123Z
x-ms-meta-OriginalFileName: document.pdf
x-ms-meta-FileSize: 2048576
x-ms-meta-FileType: application/pdf
```

### Configuration Example

```typescript
// Enable metadata with custom property names
EnableMetadata: true
UserNameProperty: "Author"
TimestampProperty: "CreatedDate"

// Add additional metadata
AdditionalMetadata: {
  "Department": "Finance",
  "Project": "Q4-Report",
  "Classification": "Internal"
}
```

### User Information Retrieval

The component retrieves user information from the Power Apps context:

1. **Model-driven Apps**: Uses the Xrm.Page context to get the current user
2. **Canvas Apps**: Attempts to get user information from the app context
3. **Fallback**: Returns null if user information cannot be retrieved

### Benefits of Metadata

1. **Audit Trail**: Complete record of who uploaded files and when
2. **Searchability**: Metadata can be used for file search and filtering
3. **Compliance**: Supports compliance requirements for file tracking
4. **Integration**: Metadata can be used by downstream processes

## Step-by-Step Setup Guide

### 1. Creating Azure Storage Resources

1. **Create an Azure Storage Account**:
   - Sign in to the Azure Portal
   - Create a new Storage Account
   - Note the storage account name

2. **Create a Blob Container**:
   - Navigate to your Storage Account
   - Under "Data storage", select "Containers"
   - Create a new container
   - Note the container name

3. **Generate a SAS Token**:
   - In your Storage Account, go to "Shared access signature"
   - Configure the required permissions (Read, Write, Create, Add)
   - Set the start and expiry dates
   - Allowed services: Blob only
   - Allowed resource types: Service, Container, Object
   - Generate the SAS token
   - Copy the SAS token value (excluding the '?' prefix)

### 2. Building and Deploying the PCF Component

1. **Clone or Download the Project**:
   ```bash
   git clone <repository-url>
   cd pcf-file-upload
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build the Component**:
   ```bash
   npm run build
   ```

4. **Create a Solution Package**:
   ```bash
   pac solution init --publisher-name <publisher-name> --publisher-prefix <prefix>
   pac solution add-reference --path .
   ```

5. **Build the Solution**:
   ```bash
   msbuild /t:restore
   msbuild
   ```

### 3. Importing and Configuring in Power Apps

1. **Import the Solution**:
   - Navigate to Power Apps Maker Portal
   - Go to Solutions
   - Import the managed solution file

2. **Add the Component to an App**:
   - Edit your app (Canvas or Model-driven)
   - Add the custom control to a screen or form
   - Configure the input properties:
     - Storage Account Name: Your Azure Storage Account name
     - Connection String: Your SAS token or connection string
     - Container Name: Your Azure Blob Container name
     - Accepted File Types: Select the file types to allow (optional, defaults to all)
     - Enable Metadata: Enable/disable metadata collection (default: true)
     - User Name Property: Metadata property name for user info (default: "UploadedBy")
     - Timestamp Property: Metadata property name for timestamp (default: "UploadedAt")
     - Additional Metadata: JSON-formatted additional metadata (optional)

3. **Test the Component**:
   - Publish the app
   - Test the file upload functionality

## Troubleshooting

### Common Issues and Solutions

#### 1. Upload Fails with Authentication Error

**Problem**: Upload fails with "403 Forbidden" or authentication error.

**Solution**:
- Verify your SAS token has the correct permissions (Read, Write, Create, Add)
- Check that the SAS token has not expired
- Ensure the storage account name and container name are correct
- Verify the SAS token is properly formatted (remove the '?' prefix if present)

#### 2. File Type Validation Issues

**Problem**: Selected file shows error "File type not supported"

**Solution**:
- Check the "Accepted File Types" configuration in the component properties
- Verify the file extension matches the allowed types
- Use "All" option to allow any file type
- Common file extensions:
  - PDF: .pdf
  - CSV: .csv
  - Word: .doc, .docx
  - Excel: .xls, .xlsx
  - PowerPoint: .ppt, .pptx
  - Images: .jpg, .jpeg, .png, .gif, .bmp
  - Text: .txt

#### 2. CORS Error

**Problem**: Browser console shows CORS error.

**Solution**:
- Configure CORS settings in your Azure Storage Account:
  1. Go to your Storage Account in Azure Portal
  2. Under "Settings", select "Resource sharing (CORS)"
  3. Add a new rule with:
     - Allowed origins: `*` or your specific domain
     - Allowed methods: GET, PUT, POST, HEAD
     - Allowed headers: `*`
     - Exposed headers: `*`
     - Max age (seconds): 86400

#### 3. File Size Limitations

**Problem**: Large files fail to upload.

**Solution**:
- Check your SAS token permissions to ensure large files are allowed
- Consider implementing chunked upload for very large files
- Verify browser and network limitations

#### 4. Network Timeout

**Problem**: Upload times out for large files.

**Solution**:
- Implement progress indicators for better user experience
- Consider increasing timeout values in your implementation
- Optimize the file before upload if possible

### Debugging Tips

1. **Browser Console**: Check the browser console for detailed error messages
2. **Network Tab**: Use browser developer tools to inspect the HTTP requests
3. **Azure Storage Logs**: Enable logging in your Azure Storage Account
4. **Component Logging**: The component includes console.log statements for debugging

## Code Examples

### 1. Basic SAS Token Generation (PowerShell)

```powershell
# Variables
$storageAccountName = "yourstorageaccount"
$containerName = "yourcontainer"
$expiryTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")

# Generate SAS token
$sasToken = New-AzStorageBlobSASToken -Container $containerName `
    -Permission "rwdlac" `
    -ExpiryTime $expiryTime `
    -Context (Get-AzStorageContext -StorageAccountName $storageAccountName)

# Output the SAS token (remove the '?' prefix)
$sasToken.Substring(1)
```

### 2. Azure CLI SAS Token Generation

```bash
#!/bin/bash

# Variables
STORAGE_ACCOUNT="yourstorageaccount"
CONTAINER_NAME="yourcontainer"
EXPIRY=$(date -u -d "+1 day" '+%Y-%m-%dT%H:%MZ')

# Generate SAS token
az storage container generate-sas \
    --account-name $STORAGE_ACCOUNT \
    --name $CONTAINER_NAME \
    --permissions rwdlac \
    --expiry $EXPIRY \
    --https-only \
    --output tsv
```

### 3. Using the Component in a Canvas App

```
// Configure the component properties
StorageAccountName: "yourstorageaccount"
ConnectionString: "sv=2022-11-02&ss=b&srt=sco&sp=rwdlacx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=example_signature"
ContainerName: "yourcontainer"
AcceptedFileTypes: "PDF" // Can be: PDF, CSV, Word, Excel, PowerPoint, Image, Text, or All
EnableMetadata: true // Enable metadata collection
UserNameProperty: "UploadedBy" // Custom property name for user info
TimestampProperty: "UploadedAt" // Custom property name for timestamp
AdditionalMetadata: "{\"Department\":\"Finance\",\"Project\":\"Q4-Report\"}" // JSON format
```

### 4. Custom Authentication Logic (Extension)

```typescript
// Example of extending the component with custom authentication
private async getCustomAuthToken(): Promise<string> {
    // Call your custom API to get a SAS token
    const response = await fetch('https://your-api.com/get-sas-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            container: this._context.parameters.containerName.raw
        })
    });
    
    const data = await response.json();
    return data.sasToken;
}
```

## Security Considerations

### SAS Token Security

1. **Principle of Least Privilege**:
   - Grant only the minimum permissions required (Read, Write, Create, Add)
   - Avoid granting Delete permissions unless necessary
   - Limit access to specific containers rather than the entire storage account

2. **Token Expiration**:
   - Use short-lived SAS tokens (recommend 24 hours or less)
   - Implement token refresh functionality for long-running sessions
   - Store tokens securely and don't expose them in client-side code longer than necessary

3. **Allowed IP Ranges**:
   - Restrict SAS token usage to specific IP ranges when possible
   - This adds an additional layer of security for enterprise environments

### Data Security

1. **Data in Transit**:
   - Always use HTTPS (enforced by the component)
   - Ensure your SAS tokens are generated with `spr=https`

2. **Data at Rest**:
   - Consider enabling Azure Storage encryption
   - Use Azure Blob Storage versioning for critical data
   - Implement soft delete if accidentally deleted files are a concern

3. **Content Validation**:
   - The component includes built-in file type validation
   - Configure accepted file types in the component properties
   - Consider implementing server-side validation for additional security
   - Scan uploaded files for malware if security is critical
4. **File Type Restrictions**:
   - Use the acceptedFileTypes property to limit uploadable file types
   - This prevents users from uploading potentially malicious files
   - Provides clear feedback when unsupported files are selected

### Access Control

1. **User Authentication**:
   - Ensure only authenticated users can access the component
   - Consider implementing role-based access control

2. **Audit Logging**:
   - Enable Azure Storage logging to track access
   - Implement custom logging for upload attempts
   - Monitor for unusual upload patterns

### Best Practices

1. **Never Store Account Keys in Client-Side Code**:
   - Account keys provide full access to your storage account
   - Use SAS tokens instead, which provide limited, time-bound access

2. **Regularly Rotate Secrets**:
   - Regenerate SAS tokens periodically
   - Update stored tokens in your configuration

3. **Monitor Usage**:
   - Set up alerts for unusual activity
   - Monitor storage costs and usage patterns
   - Implement throttling if necessary

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.0.1 | 2024-01-01 | Initial release with SAS token support |
| 0.0.2 | 2024-01-02 | Fixed SAS token parsing issue |
| 0.0.3 | 2024-01-03 | Improved error handling and notifications |
| 0.0.4 | 2024-01-04 | Enhanced UI with modern card design |
| 0.0.5 | 2024-01-05 | Added file type validation and close button |
| 0.0.6 | 2024-01-06 | Added progress bar and file size display |
| 0.0.7 | 2024-01-07 | Added file type-specific icons |
| 0.0.8 | 2024-01-08 | Added animations and transitions |

## Support

For issues or questions regarding the PCF File Upload Component:
1. Check this documentation for common solutions
2. Review the browser console for detailed error messages
3. Verify your Azure Storage configuration
4. Consult the Power Apps Component Framework documentation

## License

This component is provided as-is for educational and development purposes. Please ensure compliance with your organization's policies and licensing requirements when using in production environments.