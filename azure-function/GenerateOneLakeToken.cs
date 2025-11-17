using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace FileUploadFunctions
{
    public static class GenerateOneLakeToken
    {
        private static readonly HttpClient Http = new HttpClient();

        [FunctionName("GenerateOneLakeToken")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("GenerateOneLakeToken function processed a request.");

            try
            {
                var tenantId = Environment.GetEnvironmentVariable("TenantId");
                var clientId = Environment.GetEnvironmentVariable("ClientId");
                var clientSecret = Environment.GetEnvironmentVariable("ClientSecret");

                if (string.IsNullOrWhiteSpace(tenantId) ||
                    string.IsNullOrWhiteSpace(clientId) ||
                    string.IsNullOrWhiteSpace(clientSecret))
                {
                    return new BadRequestObjectResult(new { error = "TenantId, ClientId or ClientSecret not configured" });
                }

                var tokenEndpoint = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";

                var content = new StringContent(
                    $"client_id={Uri.EscapeDataString(clientId)}&" +
                    $"client_secret={Uri.EscapeDataString(clientSecret)}&" +
                    $"scope={Uri.EscapeDataString("https://storage.azure.com/.default")}&" +
                    $"grant_type=client_credentials",
                    Encoding.UTF8,
                    "application/x-www-form-urlencoded"
                );

                var response = await Http.PostAsync(tokenEndpoint, content);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    log.LogError($"AAD token request failed: {response.StatusCode} - {err}");
                    return new StatusCodeResult(500);
                }

                var payload = await response.Content.ReadAsStringAsync();
                dynamic token = JsonConvert.DeserializeObject(payload);
                string accessToken = token?.access_token;
                int expiresIn = token?.expires_in ?? 3300;
                string expiresAt = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToString("o");

                return new OkObjectResult(new
                {
                    accessToken = accessToken,
                    expiresAt = expiresAt,
                    expires_in = expiresIn,
                    token_type = "Bearer"
                });
            }
            catch (Exception ex)
            {
                log.LogError($"Error generating OneLake token: {ex.Message}");
                return new StatusCodeResult(500);
            }
        }
    }
}

