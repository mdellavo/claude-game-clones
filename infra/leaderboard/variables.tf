variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "allowed_origins" {
  description = "Origins allowed to call the API, e.g. [\"https://<user>.github.io\"]"
  type        = list(string)
}

variable "games" {
  description = "Game folder names that may have a leaderboard; anything else is rejected"
  type        = list(string)
  default = [
    "balloon-fight",
    "block-party",
    "claws-over-tarowa",
    "gorvax-rising",
    "granite-line",
    "hack-the-planet",
    "hollowmere",
    "howard-the-duck",
    "kahuna-curl",
    "kraken-squall",
    "neon-skitch",
    "polygon-wing",
    "porchlight",
    "powder-chute",
    "purr-patrol",
    "radio-rally-3d",
    "rotgate",
    "second-strike",
    "shred-city",
    "spike-beach",
    "tide-breaker",
    "tiki-toss",
    "wake-cutter",
    "xcom",
    "zelda",
    "zenithian-chronicles",
  ]
}

variable "lower_is_better" {
  description = "Games whose score is a time or count where the smallest number ranks first"
  type        = list(string)
  default = [
    "claws-over-tarowa",
    "hack-the-planet",
    "howard-the-duck",
    "kraken-squall",
    "neon-skitch",
    "porchlight",
    "tide-breaker",
    "tiki-toss",
  ]
}

variable "max_score" {
  description = "Scores above this are rejected as forged"
  type        = number
  default     = 1000000000
}

variable "reserved_concurrency" {
  description = "Cap on simultaneous Lambda executions, which bounds spend. Set to -1 for no cap if the account's concurrency quota is too low to reserve any."
  type        = number
  default     = 5
}

variable "alert_email" {
  description = "If set, creates a $1/month budget that emails this address when exceeded"
  type        = string
  default     = null
}
