import * as vscode from 'vscode';
import * as YAML from 'yaml';
import * as path from 'path';

// Create a diagnostics collection for YAML validation errors
export const yamlDiagnostics = vscode.languages.createDiagnosticCollection('difyYaml');

/**
 * Validates a YAML file and reports any errors
 * @param document The text document to validate
 */
export function validateYamlDocument(document: vscode.TextDocument): void {
	// Only validate manifest.yaml files
	const fileName = path.basename(document.fileName);
	if (fileName !== 'manifest.yaml') {
		return;
	}

	const diagnostics: vscode.Diagnostic[] = [];
	const text = document.getText();

	try {
		// Try to parse the YAML
		const parsedYaml = YAML.parse(text);
		console.log('YAML parsed successfully');
		
		// Validate required fields (you can extend this with more specific validation)
		if (!parsedYaml) {
			throw new Error('Empty YAML document');
		}
		
		// Define required fields based on the schema
		const requiredTopLevelFields = [
			'version', 'type', 'author', 'name', 'label', 
			'description', 'icon', 'resource', 'meta'
		];

		// Check required top-level fields
		for (const field of requiredTopLevelFields) {
			if (!parsedYaml[field]) {
				const regex = new RegExp(`${field}\\s*:`, 'g');
				const match = regex.exec(text);
				
				if (match) {
					// Field exists but might be empty
					const position = document.positionAt(match.index);
					const range = new vscode.Range(position, position.translate(0, field.length + 1));
					const diagnostic = new vscode.Diagnostic(
						range,
						`The '${field}' field is required but has no value`,
						vscode.DiagnosticSeverity.Error
					);
					diagnostics.push(diagnostic);
				} else {
					// Field doesn't exist
					const diagnostic = new vscode.Diagnostic(
						new vscode.Range(0, 0, 0, 0),
						`Missing required field: '${field}'`,
						vscode.DiagnosticSeverity.Error
					);
					diagnostics.push(diagnostic);
				}
			}
		}
		
		// Validate type field
		if (parsedYaml.type && parsedYaml.type !== 'plugin') {
			const typeMatch = /type\s*:/.exec(text);
			if (typeMatch) {
				const position = document.positionAt(typeMatch.index);
				const diagnostic = new vscode.Diagnostic(
					new vscode.Range(position, position.translate(0, typeMatch[0].length + parsedYaml.type.length)),
					"Type must be 'plugin'",
					vscode.DiagnosticSeverity.Error
				);
				diagnostics.push(diagnostic);
			}
		}
		
		// Validate label and description fields (must have language variants)
		const languageFields = ['label', 'description'];
		for (const field of languageFields) {
			if (parsedYaml[field] && typeof parsedYaml[field] === 'object') {
				// At least one language variant should be present
				const hasAnyLanguage = Object.keys(parsedYaml[field]).length > 0;
				if (!hasAnyLanguage) {
					const fieldMatch = new RegExp(`${field}\\s*:`, 'g').exec(text);
					if (fieldMatch) {
						const position = document.positionAt(fieldMatch.index);
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(position, position.translate(0, fieldMatch[0].length)),
							`The '${field}' field must have at least one language variant`,
							vscode.DiagnosticSeverity.Error
						);
						diagnostics.push(diagnostic);
					}
				}
			}
		}
		
		// Validate resource field
		if (parsedYaml.resource && typeof parsedYaml.resource === 'object') {
			// Check if memory is defined
			if (!parsedYaml.resource.memory) {
				const diagnostic = createMissingNestedFieldDiagnostic(text, 'resource', 'memory', document);
				if (diagnostic) diagnostics.push(diagnostic);
			}
			
			// Check permission structure
			if (!parsedYaml.resource.permission) {
				const diagnostic = createMissingNestedFieldDiagnostic(text, 'resource', 'permission', document);
				if (diagnostic) diagnostics.push(diagnostic);
			}
		}
		
		// Validate meta field
		if (parsedYaml.meta && typeof parsedYaml.meta === 'object') {
			// Check for required meta fields
			const requiredMetaFields = ['version', 'arch', 'runner'];
			for (const field of requiredMetaFields) {
				if (!parsedYaml.meta[field]) {
					const diagnostic = createMissingNestedFieldDiagnostic(text, 'meta', field, document);
					if (diagnostic) diagnostics.push(diagnostic);
				}
			}
			
			// Check runner structure if it exists
			if (parsedYaml.meta.runner) {
				const requiredRunnerFields = ['language', 'version', 'entrypoint'];
				for (const field of requiredRunnerFields) {
					if (!parsedYaml.meta.runner[field]) {
						const diagnostic = createMissingNestedFieldDiagnostic(
							text, 'meta.runner', field, document, 'meta'
						);
						if (diagnostic) diagnostics.push(diagnostic);
					}
				}
			}
		}
		
	} catch (error) {
		// Handle parsing errors
		console.error('YAML parsing error:', error);
		
		// Create a diagnostic for the parsing error
		const message = error instanceof Error ? error.message : String(error);
		const lineMatch = message.match(/line (\d+)/);
		
		let range;
		if (lineMatch && lineMatch[1]) {
			const lineNumber = parseInt(lineMatch[1], 10) - 1;
			const line = document.lineAt(Math.min(lineNumber, document.lineCount - 1));
			range = new vscode.Range(line.range.start, line.range.end);
		} else {
			range = new vscode.Range(0, 0, 0, 0);
		}
		
		const diagnostic = new vscode.Diagnostic(
			range,
			`YAML parsing error: ${message}`,
			vscode.DiagnosticSeverity.Error
		);
		diagnostics.push(diagnostic);
	}

	// Update diagnostics
	yamlDiagnostics.set(document.uri, diagnostics);
}

/**
 * Helper function to create a diagnostic for a missing nested field
 */
function createMissingNestedFieldDiagnostic(
	text: string, 
	parentField: string, 
	childField: string, 
	document: vscode.TextDocument, 
	grandparentField?: string
): vscode.Diagnostic | null {
	// Build the regex pattern based on whether we have a grandparent field
	let pattern: RegExp;
	let searchText = text;
	let parentOffset = 0;
	
	if (grandparentField) {
		// First find the grandparent
		const grandparentMatch = new RegExp(`${grandparentField}\\s*:`, 'g').exec(searchText);
		if (!grandparentMatch) return null;
		
		// Update the search scope to start from after the grandparent
		parentOffset = grandparentMatch.index;
		searchText = searchText.substring(parentOffset);
	}
	
	// Now search for the parent field within our search scope
	pattern = new RegExp(`${parentField}\\s*:`, 'g');
	const parentMatch = pattern.exec(searchText);
	
	if (parentMatch) {
		const position = document.positionAt(parentOffset + parentMatch.index);
		return new vscode.Diagnostic(
			new vscode.Range(position, position.translate(0, parentMatch[0].length)),
			`Missing required field '${childField}' in ${parentField}`,
			vscode.DiagnosticSeverity.Error
		);
	}
	
	return null;
}

/**
 * Checks if a file is a manifest.yaml file
 */
export function isManifestFile(document: vscode.TextDocument): boolean {
	return path.basename(document.fileName) === 'manifest.yaml';
} 