// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { validateManifest } from './validator';
import { DifyManifestDecorationProvider } from './decorationProvider';

// Global state
let diagnosticCollection: vscode.DiagnosticCollection;
const decorationProvider = new DifyManifestDecorationProvider();
const confirmedDifyDirs: Set<string> = new Set(); // Store URIs as strings

/**
 * Checks if a given workspace folder is a Dify tool directory
 * by looking for .difyignore, manifest.yaml, and main.py.
 * Updates global state and triggers validation/decoration if it is.
 * @param folder The workspace folder to check.
 */
function checkDifyDirectory(folder: vscode.WorkspaceFolder): void {
	const workspaceRoot = folder.uri.fsPath;
	const workspaceUriString = folder.uri.toString();
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
			// If it was previously considered a Dify dir, remove it
			if (confirmedDifyDirs.has(workspaceUriString)) {
				confirmedDifyDirs.delete(workspaceUriString);
				decorationProvider.removeDifyDirectory(workspaceUriString);
				 // Clear diagnostics for the manifest in this folder if it exists
				 const manifestUri = vscode.Uri.joinPath(folder.uri, 'manifest.yaml');
				 diagnosticCollection.delete(manifestUri);
				console.log(`Removed ${folder.name} from confirmed Dify directories.`);
			}
			return; // Exit check for this folder
		}
	}

	// If all required files exist
	if (allFilesExist && !confirmedDifyDirs.has(workspaceUriString)) {
		confirmedDifyDirs.add(workspaceUriString);
		decorationProvider.addDifyDirectory(workspaceUriString);
		vscode.window.showInformationMessage(`Dify tool directory detected in "${folder.name}". Validator is active.`);
		console.log(`Confirmed Dify tool directory: ${workspaceRoot}`);

		// Trigger validation for the manifest file in this newly confirmed directory
		// Check if the manifest is already open
		const manifestUri = vscode.Uri.joinPath(folder.uri, 'manifest.yaml');
		const openEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === manifestUri.toString());
		if (openEditor) {
			validateManifest(openEditor.document, diagnosticCollection, folder.uri);
		}
	} else if (allFilesExist) {
		 console.log(`Folder ${folder.name} is already confirmed as a Dify directory.`);
	}
}

// Function to find the workspace folder containing a given document uri
function getWorkspaceFolderForUri(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
	return vscode.workspace.workspaceFolders?.find(folder => uri.fsPath.startsWith(folder.uri.fsPath));
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Dify Developer Kit extension is activating.');

	// Create diagnostics collection
	diagnosticCollection = vscode.languages.createDiagnosticCollection('difyManifest');
	context.subscriptions.push(diagnosticCollection);

	// Register decoration provider
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);

	// Initial check of existing workspace folders
	if (vscode.workspace.workspaceFolders) {
		console.log(`Found ${vscode.workspace.workspaceFolders.length} workspace folders on activation.`);
		vscode.workspace.workspaceFolders.forEach(checkDifyDirectory);
	} else {
		console.log('No workspace folders open on activation.');
	}

	// Update decoration provider with initially found directories
	// decorationProvider.updateDifyDirectories(confirmedDifyDirs); // updateDifyDirectories is called within checkDifyDirectory now

	// --- Event Listeners --- 

	// Listen for changes in workspace folders (add/remove)
	const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(event => {
		console.log('Workspace folders changed.');
		// Check any folders that were added
		event.added.forEach(checkDifyDirectory);

		// Handle removed folders
		event.removed.forEach(folder => {
			const removedUriString = folder.uri.toString();
			if (confirmedDifyDirs.has(removedUriString)) {
				confirmedDifyDirs.delete(removedUriString);
				decorationProvider.removeDifyDirectory(removedUriString);
				// Clear diagnostics for the manifest in the removed folder
				const manifestUri = vscode.Uri.joinPath(folder.uri, 'manifest.yaml');
				diagnosticCollection.delete(manifestUri);
				console.log(`Removed folder detected: ${folder.name}. Cleaned up state.`);
			}
		});
	});

	// Listen for when a document is opened
	const didOpenListener = vscode.workspace.onDidOpenTextDocument(document => {
		if (path.basename(document.uri.fsPath) === 'manifest.yaml') {
			const folder = getWorkspaceFolderForUri(document.uri);
			if (folder && confirmedDifyDirs.has(folder.uri.toString())) {
				console.log(`Validating opened manifest.yaml in ${folder.name}`);
				validateManifest(document, diagnosticCollection, folder.uri);
			}
		}
	});

	// Listen for when a document is saved
	const didSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
		if (path.basename(document.uri.fsPath) === 'manifest.yaml') {
			const folder = getWorkspaceFolderForUri(document.uri);
			if (folder && confirmedDifyDirs.has(folder.uri.toString())) {
				console.log(`Validating saved manifest.yaml in ${folder.name}`);
				validateManifest(document, diagnosticCollection, folder.uri);
			}
		}
	});

	 // Listen for when the active editor changes
	const didChangeActiveEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && path.basename(editor.document.uri.fsPath) === 'manifest.yaml') {
			const folder = getWorkspaceFolderForUri(editor.document.uri);
			if (folder && confirmedDifyDirs.has(folder.uri.toString())) {
				// Re-validate when switching *to* a manifest file, in case it wasn't open before
				 console.log(`Validating active manifest.yaml in ${folder.name}`);
				validateManifest(editor.document, diagnosticCollection, folder.uri);
			}
		}
	});

	// Initial validation for already open manifest files in confirmed dirs
	vscode.window.visibleTextEditors.forEach(editor => {
		 if (path.basename(editor.document.uri.fsPath) === 'manifest.yaml') {
			const folder = getWorkspaceFolderForUri(editor.document.uri);
			 if (folder && confirmedDifyDirs.has(folder.uri.toString())) {
				 console.log(`Initial validation for open manifest.yaml in ${folder.name}`);
				validateManifest(editor.document, diagnosticCollection, folder.uri);
			 }
		 }
	});

	// Add disposables to subscriptions
	context.subscriptions.push(
		workspaceWatcher,
		didOpenListener,
		didSaveListener,
		didChangeActiveEditorListener
	);

	console.log('Dify Developer Kit activation complete. Listening for changes.');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Dify Developer Kit extension is deactivating.');
	// Clean up resources if needed
	if (diagnosticCollection) {
		diagnosticCollection.clear();
		diagnosticCollection.dispose();
	}
}
