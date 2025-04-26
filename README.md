# Dify Plugin Schema

A Visual Studio Code extension that provides schema validation for Dify Plugin configuration files.

## Features

This extension provides JSON schema validation for Dify Plugin configuration files, including:

- Schema validation for `manifest.yaml` files
- Schema validation for tool configuration files in the `tools/*.yaml` pattern
- Schema validation for provider configuration files in the `provider/*.yaml` pattern

When editing these YAML files, you'll receive:

- Syntax validation
- Auto-completion suggestions
- Hover documentation
- Error highlighting for invalid configuration

## Requirements

This extension depends on the "YAML Support by Red Hat" extension, which will be automatically installed as a dependency.

## Installation

You can install this extension through the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Dify Plugin Schema"
4. Click Install

## Usage

The extension automatically activates when a `manifest.yaml` file is detected in your workspace. Schema validation will be applied to:

- `/manifest.yaml` - Dify Plugin manifest
- `/tools/*.yaml` - Tool configuration files
- `/provider/*.yaml` - Provider configuration files

## Schema Details

The extension uses the following schema URLs:

- Manifest: `https://lcandy2.github.io/vscode-dify-plugin-schema/src/schema/manifest.json`
- Tools: `https://lcandy2.github.io/vscode-dify-plugin-schema/src/schema/tools/tools.json`
- Provider: `https://lcandy2.github.io/vscode-dify-plugin-schema/src/schema/tools/provider.json`

## Release Notes

### 0.0.1

Initial release of Dify Plugin Schema extension with:
- Support for manifest.yaml validation
- Support for tools/*.yaml validation
- Support for provider/*.yaml validation

---

## For more information

* [Dify Official Website](https://dify.ai/)
* [Visual Studio Code's YAML Support](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)

**Enjoy building with Dify!**
