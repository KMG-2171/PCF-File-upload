using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage;
using Azure.Storage.Sas;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Specialized;

namespace FileUploadFunctions
{
    public static class GenerateSasToken
    {
        [FunctionName("GenerateSasToken")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("GenerateSasToken function processed a request.");

            try
            {
                // Parse query parameters or request body
                string blobName = req.Query["blobName"];
                string permission = req.Query["permission"];
                string durationStr = req.Query["duration"];
                string storageConnectionString = Environment.GetEnvironmentVariable("AzureStorageConnectionString");
                string containerName = Environment.GetEnvironmentVariable("ContainerName");

                // If using POST request body
                if (string.IsNullOrEmpty(blobName) && req.Method == "POST")
                {
                    string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                    dynamic data = JsonConvert.DeserializeObject(requestBody);
                    blobName = data?.blobName;
                    permission = data?.permission;
                    durationStr = data?.duration;
                }

                // Validate required parameters
                if (string.IsNullOrEmpty(blobName))
                {
                    return new BadRequestObjectResult(new { error = "blobName parameter is required" });
                }

                if (string.IsNullOrEmpty(storageConnectionString))
                {
                    return new BadRequestObjectResult(new { error = "Azure storage connection not configured" });
                }

                if (string.IsNullOrEmpty(containerName))
                {
                    return new BadRequestObjectResult(new { error = "Container name not configured" });
                }

                // Set defaults
                if (string.IsNullOrEmpty(permission))
                {
                    permission = "rw"; // Read + Write
                }

                // Default duration: 1 hour
                int duration = 3600;
                if (!string.IsNullOrEmpty(durationStr) && int.TryParse(durationStr, out int requestedDuration))
                {
                    // Cap at 24 hours for security
                    duration = Math.Min(requestedDuration, 86400);
                }

                // Create blob service client
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                var blobClient = containerClient.GetBlobClient(blobName);

                // Build SAS token with specified permissions and expiration
                var blobSasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = containerName,
                    BlobName = blobName,
                    Resource = "b", // blob
                    ExpiresOn = DateTimeOffset.UtcNow.AddSeconds(duration)
                };

                // Set permissions based on request
                if (permission.Contains("r"))
                {
                    blobSasBuilder.SetPermissions(BlobSasPermissions.Read);
                }
                if (permission.Contains("w"))
                {
                    blobSasBuilder.SetPermissions(BlobSasPermissions.Write | BlobSasPermissions.Create);
                }
                if (permission.Contains("d"))
                {
                    blobSasBuilder.SetPermissions(BlobSasPermissions.Delete);
                }
                if (permission.Contains("a"))
                {
                    blobSasBuilder.SetPermissions(BlobSasPermissions.Add);
                }

                // Generate SAS URI
                var sasUri = blobClient.GenerateUri(blobSasBuilder);
                var sasToken = sasUri.Query.Substring(1); // Remove the '?' prefix

                // Build the complete upload URL
                string uploadUrl = $"https://{blobServiceClient.AccountName}.blob.core.windows.net/{containerName}/{blobName}?{sasToken}";

                var response = new
                {
                    uploadUrl = uploadUrl,
                    blobName = blobName,
                    containerName = containerName,
                    accountName = blobServiceClient.AccountName,
                    expiresAt = blobSasBuilder.ExpiresOn.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    permissions = permission,
                    duration = duration
                };

                log.LogInformation($"Generated SAS token for blob: {blobName}, expires: {blobSasBuilder.ExpiresOn}");

                return new OkObjectResult(response);
            }
            catch (Exception ex)
            {
                log.LogError($"Error generating SAS token: {ex.Message}");
                return new StatusCodeResult(500);
            }
        }
    }

    // Additional helper function for validating blob names
    public static class BlobNameValidator
    {
        public static bool IsValidBlobName(string blobName)
        {
            if (string.IsNullOrWhiteSpace(blobName))
                return false;

            // Check for invalid blob name characters
            char[] invalidChars = { '\\', '/', '?', '#', ':', '*', '"', '<', '>', '|', '\0', '\t' };

            foreach (char invalidChar in invalidChars)
            {
                if (blobName.Contains(invalidChar))
                    return false;
            }

            // Check length (max 1024 characters)
            if (blobName.Length > 1024)
                return false;

            // Check for trailing spaces or dots
            if (blobName.EndsWith(" ") || blobName.EndsWith("."))
                return false;

            return true;
        }
    }
}