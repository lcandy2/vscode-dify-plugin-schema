// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

	// Add the watcher to the subscriptions for cleanup when the extension deactivates
	context.subscriptions.push(workspaceWatcher);

	console.log('Dify Developer Kit activation complete.');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Dify Developer Kit extension is deactivating.');
}
