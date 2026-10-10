terraform {
  required_version = ">= 1.5"

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.0" }
  }
}

provider "aws" {
  region = var.region
}

# One item per game, holding that game's top scores.
resource "aws_dynamodb_table" "leaderboards" {
  name         = "leaderboards"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "game"

  attribute {
    name = "game"
    type = "S"
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/index.mjs"
  output_path = "${path.module}/build/lambda.zip"
}

resource "aws_iam_role" "lambda" {
  name = "leaderboard-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "leaderboard-lambda"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
        Resource = aws_dynamodb_table.leaderboards.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "leaderboard" {
  function_name                  = "leaderboard"
  role                           = aws_iam_role.lambda.arn
  runtime                        = "nodejs22.x"
  handler                        = "index.handler"
  filename                       = data.archive_file.lambda.output_path
  source_code_hash               = data.archive_file.lambda.output_base64sha256
  memory_size                    = 128
  timeout                        = 5
  reserved_concurrent_executions = var.reserved_concurrency

  environment {
    variables = {
      TABLE           = aws_dynamodb_table.leaderboards.name
      GAMES           = join(",", var.games)
      LOWER_IS_BETTER = join(",", var.lower_is_better)
      MAX_SCORE       = tostring(var.max_score)
    }
  }
}

resource "aws_lambda_function_url" "leaderboard" {
  function_name      = aws_lambda_function.leaderboard.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"]
    max_age       = 86400
  }
}

# A public Function URL needs both of these; Terraform does not add them the way the console does.
resource "aws_lambda_permission" "url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.leaderboard.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "url_invoke" {
  statement_id             = "AllowPublicInvokeViaUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.leaderboard.function_name
  principal                = "*"
  invoked_via_function_url = true
}

resource "aws_budgets_budget" "leaderboard" {
  count = var.alert_email == null ? 0 : 1

  name         = "leaderboard"
  budget_type  = "COST"
  limit_amount = "1"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
