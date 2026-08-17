terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "sptinder-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "sptinder-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "spotify_client_id" {
  description = "Spotify OAuth client ID"
  type        = string
  sensitive   = true
}

variable "spotify_client_secret" {
  description = "Spotify OAuth client secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "AES-256 encryption key for refresh tokens"
  type        = string
  sensitive   = true
}

variable "certificate_arn" {
  description = "ACM certificate ARN for TLS"
  type        = string
}

locals {
  name = "sptinder"
}

module "vpc" {
  source = "./modules/vpc"
  name   = local.name
}

module "ecr" {
  source = "./modules/ecr"
  name   = local.name
}

module "secrets" {
  source = "./modules/secrets"
  name   = local.name

  spotify_client_id     = var.spotify_client_id
  spotify_client_secret = var.spotify_client_secret
  jwt_secret            = var.jwt_secret
  encryption_key        = var.encryption_key
}

module "database" {
  source = "./modules/database"
  name   = local.name
  vpc_id = module.vpc.vpc_id
  private_subnet_id = module.vpc.private_subnet_ids[0]
}