// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Check if a workspace folder is open
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		console.log('No workspace folder open.');
		return;
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

	// Define the files to check for
	const difyFiles = ['.difyignore', 'manifest.yaml', 'main.py'];
	let allFilesExist = true;

	// Check for the existence of each file in the workspace root
	for (const file of difyFiles) {
		const filePath = path.join(workspaceRoot, file);
		if (!fs.existsSync(filePath)) {
			allFilesExist = false;
			console.log(`Dify check: Missing file - ${file}`);
			break; // Exit the loop early if a file is missing
		}
	}

	// If all required files exist, show an information message
	if (allFilesExist) {
		vscode.window.showInformationMessage('Dify tool directory detected. Validator is active.');
		console.log('Dify tool directory detected.');
	} else {
		console.log('Not a Dify tool directory or missing required files.');
	}

	// No commands or subscriptions needed for this step yet
	// context.subscriptions.push(disposable); // Remove or comment out if not needed
}

// This method is called when your extension is deactivated
export function deactivate() {}
