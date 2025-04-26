// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { validateYamlDocument, yamlDiagnostics, isManifestFile, initializeValidator } from './yamlValidator';

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
 * Add a title decoration to manifest.yaml files
 * @param editor Text editor to inspect and possibly decorate
 */
function decorateManifestFile(editor: vscode.TextEditor | undefined): void {
	if (!editor) {
		return;
	}

	// Check if this is a manifest.yaml file
	if (!isManifestFile(editor.document)) {
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

	// Initialize the schema validator
	initializeValidator(context);

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
		if (isManifestFile(document)) {
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
