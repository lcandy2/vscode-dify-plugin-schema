// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

// Create a decoration type for the "Dify Tool Manifest File" title
const manifestTitleDecorationType = vscode.window.createTextEditorDecorationType({
	after: {
		contentText: 'Dify Tool Manifest File',
		color: '#888888',
		fontStyle: 'italic',
		margin: '0 0 0 20px'
	},
	isWholeLine: true
});

// Create a diagnostics collection for YAML validation errors
const yamlDiagnostics = vscode.languages.createDiagnosticCollection('difyYaml');

/**
 * Checks if a given workspace folder is a Dify tool directory
 * by looking for .difyignore, manifest.yaml, and main.py.
 * Shows an information message if it is.
 * @param folder The workspace folder to check.
 */
function checkDifyDirectory(folder: vscode.WorkspaceFolder): void {
	const workspaceRoot = folder.uri.fsPath;
	console.log(`Checking folder: ${workspaceRoot}`);

	// Define the files to check for
	const difyFiles = ['.difyignore', 'manifest.yaml', 'main.py'];
	let allFilesExist = true;

	// Check for the existence of each file in the workspace root
	for (const file of difyFiles) {
		const filePath = path.join(workspaceRoot, file);
		if (!fs.existsSync(filePath)) {
			allFilesExist = false;
			console.log(`Dify check: Missing file - ${file} in ${workspaceRoot}`);
			break; // Exit the loop early if a file is missing
		}
	}

	// If all required files exist, show an information message
	if (allFilesExist) {
		vscode.window.showInformationMessage(`Dify tool directory detected in "${folder.name}". Validator is active.`);
		console.log(`Dify tool directory detected in ${workspaceRoot}`);
	} else {
		console.log(`"${folder.name}" is not a Dify tool directory or missing required files.`);
	}
}

/**
 * Validates a YAML file and reports any errors
 * @param document The text document to validate
 */
function validateYamlDocument(document: vscode.TextDocument): void {
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
		console.log('YAML parsed successfully:', parsedYaml);
		
		// Validate required fields (you can extend this with more specific validation)
		if (!parsedYaml) {
			throw new Error('Empty YAML document');
		}
		
		// Check for required fields in manifest.yaml
		const requiredFields = ['name', 'version', 'description'];
		for (const field of requiredFields) {
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
 * Add a title decoration to manifest.yaml files
 * @param editor Text editor to inspect and possibly decorate
 */
function decorateManifestFile(editor: vscode.TextEditor | undefined): void {
	if (!editor) {
		return;
	}

	// Check if this is a manifest.yaml file
	const fileName = path.basename(editor.document.fileName);
	if (fileName !== 'manifest.yaml') {
		return;
	}

	// Apply the decoration to the first line
	const decorations: vscode.DecorationOptions[] = [{
		range: new vscode.Range(0, 0, 0, 0),
		hoverMessage: 'This is the main configuration file for a Dify tool'
	}];
	
	editor.setDecorations(manifestTitleDecorationType, decorations);
	
	// Also validate the YAML
	validateYamlDocument(editor.document);
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Dify Developer Kit extension is activating.');

	// Check existing workspace folders when the extension activates
	if (vscode.workspace.workspaceFolders) {
		console.log(`Found ${vscode.workspace.workspaceFolders.length} workspace folders.`);
		vscode.workspace.workspaceFolders.forEach(checkDifyDirectory);
	} else {
		console.log('No workspace folders open on activation.');
	}

	// Listen for changes in workspace folders (add/remove)
	const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(event => {
		console.log('Workspace folders changed.');
		// Check any folders that were added
		if (event.added) {
			console.log(`Folders added: ${event.added.length}`);
			event.added.forEach(checkDifyDirectory);
		}
		// Optionally handle removed folders if needed
		if (event.removed) {
			console.log(`Folders removed: ${event.removed.length}`);
			// Add logic here if you need to do something when a Dify folder is closed
		}
	});

	// Check the active editor when extension starts
	if (vscode.window.activeTextEditor) {
		decorateManifestFile(vscode.window.activeTextEditor);
	}

	// Listen for changes to the active text editor and apply decorations if needed
	const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		decorateManifestFile(editor);
	});

	// Also listen for text document changes to update decorations when content changes
	const documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
		if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
			decorateManifestFile(vscode.window.activeTextEditor);
		}
	});

	// Listen for document saves to validate YAML
	const documentSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
		// Check if this is a manifest.yaml file
		const fileName = path.basename(document.fileName);
		if (fileName === 'manifest.yaml') {
			validateYamlDocument(document);
		}
	});

	// Add the watchers to the subscriptions for cleanup when the extension deactivates
	context.subscriptions.push(
		workspaceWatcher,
		editorChangeListener,
		documentChangeListener,
		documentSaveListener,
		manifestTitleDecorationType,
		yamlDiagnostics
	);

	console.log('Dify Developer Kit activation complete.');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Dify Developer Kit extension is deactivating.');
}
