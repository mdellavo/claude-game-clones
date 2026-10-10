output "url" {
  description = "Base URL of the leaderboard API"
  value       = aws_lambda_function_url.leaderboard.function_url
}
