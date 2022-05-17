#variable "out_dir" {
#  type = string
#}
#
#variable "out_files_basenames" {
#  type = object({
#    rootfs = object({
#      basename = string
#    })
#
#    snap = object({
#      snapfile_basename = string
#      memfile_basename  = string
#    })
#  })
#}

variable "gcp_zone" {
  type = string
}
