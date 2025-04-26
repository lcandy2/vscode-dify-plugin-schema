import * as vscode from 'vscode';
import * as YAML from 'yaml';
import * as path from 'path';
import * as fs from 'fs';
import * as Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Create a diagnostics collection for YAML validation errors
export const yamlDiagnostics = vscode.languages.createDiagnosticCollection('difyYaml');

// Load schema from file
let schema: any = null;
let ajv: Ajv.default | null = null;
let validate: Ajv.ValidateFunction | null = null;

/**
 * Initialize the schema validation
 */
export function initializeValidator(context: vscode.ExtensionContext): void {
	try {
		const schemaPath = path.join(context.extensionPath, 'src', 'schema.json');
		const schemaContent = fs.readFileSync(schemaPath, 'utf8');
		schema = JSON.parse(schemaContent);

		// Initialize Ajv
		ajv = new Ajv.default({ allErrors: true });
		addFormats(ajv); // Add support for formats like date-time
		validate = ajv.compile(schema);
		
		console.log('Schema loaded successfully');
	} catch (error) {
		console.error('Error loading schema:', error);
	}
}

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
		
		// Check if YAML is empty
		if (!parsedYaml) {
			throw new Error('Empty YAML document');
		}
		
		// Validate against schema if available
		if (validate) {
			const valid = validate(parsedYaml);
			
			if (!valid && validate.errors) {
				for (const error of validate.errors) {
					// Get the location of the error in the document
					const range = getErrorRange(error, parsedYaml, text, document);
					
					// Create diagnostic
					const message = formatErrorMessage(error);
					const diagnostic = new vscode.Diagnostic(
						range,
						message,
						vscode.DiagnosticSeverity.Error
					);
					diagnostics.push(diagnostic);
				}
			}
		} else {
			// Fallback to basic validation if schema is not loaded
			fallbackValidation(parsedYaml, text, document, diagnostics);
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
 * Format a friendly error message from an Ajv error
 */
function formatErrorMessage(error: Ajv.ErrorObject): string {
	const { keyword, instancePath, message, params } = error;
	
	// Format the path more readably
	const path = instancePath ? instancePath.replace(/^\//, '') : '';
	const formattedPath = path.replace(/\//g, '.');
	
	// Build error message based on the keyword
	switch (keyword) {
		case 'required':
			return `Missing required property: '${params.missingProperty}'`;
		case 'type':
			return `'${formattedPath}' should be ${params.type}`;
		case 'enum':
			return `'${formattedPath}' should be one of: ${params.allowedValues.join(', ')}`;
		case 'pattern':
			return `'${formattedPath}' should match pattern: ${params.pattern}`;
		case 'format':
			return `'${formattedPath}' should be a valid ${params.format}`;
		case 'minimum':
			return `'${formattedPath}' should be >= ${params.limit}`;
		case 'maximum':
			return `'${formattedPath}' should be <= ${params.limit}`;
		case 'minProperties':
			return `'${formattedPath}' should have at least ${params.limit} properties`;
		default:
			return message || `Validation error in ${formattedPath || 'manifest'}`;
	}
}

/**
 * Try to find the range in the document that corresponds to the error
 */
function getErrorRange(
	error: Ajv.ErrorObject, 
	parsedYaml: any, 
	text: string, 
	document: vscode.TextDocument
): vscode.Range {
	// Default range (beginning of file)
	const defaultRange = new vscode.Range(0, 0, 0, 0);
	
	try {
		// Get the path from the error
		const path = error.instancePath.replace(/^\//, '').split('/');
		
		if (error.keyword === 'required') {
			// If the error is about a missing required field
			const parentPath = path.length ? path.join('.') + '.' : '';
			const fieldName = error.params.missingProperty;
			
			// Try to find the parent object in the YAML text
			let searchText = text;
			let parentFound = false;
			let parentPos = 0;
			
			// If we have a parent path, find its position
			if (parentPath) {
				const parentSegments = parentPath.split('.');
				let currentPath = '';
				let currentOffset = 0;
				
				for (const segment of parentSegments) {
					currentPath = currentPath ? `${currentPath}.${segment}` : segment;
					const regex = new RegExp(`${segment}\\s*:`, 'g');
					const match = regex.exec(searchText);
					
					if (match) {
						currentOffset += match.index;
						parentFound = true;
						parentPos = currentOffset;
						
						// Update search text to look only after this match
						searchText = searchText.substring(match.index + match[0].length);
					} else {
						parentFound = false;
						break;
					}
				}
			} else {
				// If no parent path, we're at the root
				parentFound = true;
			}
			
			if (parentFound) {
				const position = document.positionAt(parentPos);
				return new vscode.Range(position, position);
			}
		} else {
			// For other types of errors, try to find the property in the text
			const fullPath = path.join('.');
			const regex = new RegExp(`${fullPath.replace(/\./g, '\\s*\\.\\s*')}\\s*:`, 'g');
			const match = regex.exec(text);
			
			if (match) {
				const position = document.positionAt(match.index);
				return new vscode.Range(position, position.translate(0, match[0].length));
			}
			
			// If we couldn't find the property by its full path, try the last segment
			if (path.length > 0) {
				const lastSegment = path[path.length - 1];
				const segmentRegex = new RegExp(`${lastSegment}\\s*:`, 'g');
				const segmentMatch = segmentRegex.exec(text);
				
				if (segmentMatch) {
					const position = document.positionAt(segmentMatch.index);
					return new vscode.Range(position, position.translate(0, segmentMatch[0].length));
				}
			}
		}
	} catch (e) {
		console.error('Error finding range for validation error:', e);
	}
	
	return defaultRange;
}

/**
 * Fallback validation when schema is not available
 */
function fallbackValidation(
	parsedYaml: any, 
	text: string, 
	document: vscode.TextDocument, 
	diagnostics: vscode.Diagnostic[]
): void {
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
}

/**
 * Checks if a file is a manifest.yaml file
 */
export function isManifestFile(document: vscode.TextDocument): boolean {
	return path.basename(document.fileName) === 'manifest.yaml';
} 