# SSM Parameter Store for secrets

variable "name" {
  description = "Name prefix for resources"
  type        = string
}

resource "aws_ssm_parameter" "spotify_client_id" {
  name  = "/${var.name}/spotify-client-id"
  type  = "SecureString"
  value = var.spotify_client_id
}

resource "aws_ssm_parameter" "spotify_client_secret" {
  name  = "/${var.name}/spotify-client-secret"
  type  = "SecureString"
  value = var.spotify_client_secret
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.name}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "/${var.name}/encryption-key"
  type  = "SecureString"
  value = var.encryption_key
}

variable "spotify_client_id" {
  type = string
}

variable "spotify_client_secret" {
  type = string
}

variable "jwt_secret" {
  type = string
}

variable "encryption_key" {
  type = string
}

output "spotify_client_id_arn" {
  value = aws_ssm_parameter.spotify_client_id.arn
}

output "spotify_client_secret_arn" {
  value = aws_ssm_parameter.spotify_client_secret.arn
}

output "jwt_secret_arn" {
  value = aws_ssm_parameter.jwt_secret.arn
}

output "encryption_key_arn" {
  value = aws_ssm_parameter.encryption_key.arn
}