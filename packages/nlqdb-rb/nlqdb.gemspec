# frozen_string_literal: true

require_relative "lib/nlqdb/version"

Gem::Specification.new do |spec|
  spec.name = "nlqdb"
  spec.version = Nlqdb::VERSION
  spec.authors = ["nlqdb team"]
  spec.email = ["info@nlqdb.com"]
  spec.summary = "Ruby client for nlqdb — natural-language databases"
  spec.description = "Placeholder gem. Real implementation coming in Phase 2."
  spec.homepage = "https://nlqdb.com"
  spec.license = "FSL-1.1-ALv2"
  spec.required_ruby_version = ">= 3.0"
  spec.metadata["source_code_uri"] = "https://github.com/nlqdb/nlqdb"

  spec.files = Dir["{lib,exe,sig}/**/*", "README.md", "LICENSE"]
  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{^exe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  # TODO: real dependencies in Phase 2
end
