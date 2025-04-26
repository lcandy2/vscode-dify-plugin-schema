// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Keep track of Dify directories
const difyDirectories = new Set<string>();

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

	// If all required files exist, show an information message and register the schema
	if (allFilesExist) {
		vscode.window.showInformationMessage(`Dify tool directory detected in "${folder.name}". Validator is active.`);
		console.log(`Dify tool directory detected in ${workspaceRoot}`);
		
		// Add to our set of Dify directories
		difyDirectories.add(workspaceRoot);
		
		// Register the schema for this manifest.yaml file
		registerSchema(path.join(workspaceRoot, 'manifest.yaml'));
	} else {
		console.log(`"${folder.name}" is not a Dify tool directory or missing required files.`);
		
		// If it was previously detected as a Dify directory, remove it
		if (difyDirectories.has(workspaceRoot)) {
			difyDirectories.delete(workspaceRoot);
		}
	}
}

/**
 * Registers the schema for a manifest.yaml file using the yaml-language-server's modeline
 * @param manifestPath Path to the manifest.yaml file
 */
async function registerSchema(manifestPath: string): Promise<void> {
	try {
		// Get the schema path
		const extensionPath = vscode.extensions.getExtension('dify-developer-kit')?.extensionPath;
		if (!extensionPath) {
			console.error('Could not find extension path');
			return;
		}
		
		const schemaPath = path.join(extensionPath, 'src', 'schema.json');
		
		// Check if the file exists
		if (!fs.existsSync(manifestPath)) {
			console.error(`Manifest file not found: ${manifestPath}`);
			return;
		}
		
		// Read the manifest file
		const content = fs.readFileSync(manifestPath, 'utf8');
		
		// Check if the modeline already exists
		if (content.includes('yaml-language-server: $schema=')) {
			// Schema modeline already exists, no need to add it
			console.log(`Schema modeline already exists in ${manifestPath}`);
			return;
		}
		
		// Add the modeline at the top of the file
		const relativeSchemaPath = path.relative(path.dirname(manifestPath), schemaPath);
		const modeline = `# yaml-language-server: $schema=${relativeSchemaPath}\n`;
		const newContent = modeline + content;
		
		// Write the file back
		fs.writeFileSync(manifestPath, newContent, 'utf8');
		console.log(`Added schema modeline to ${manifestPath}`);
		
		// Notify the editor that the file has changed
		const fileUri = vscode.Uri.file(manifestPath);
		
		// If the file is open in an editor, reload it
		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri.fsPath === manifestPath) {
				// The file is open, show a notification to reload
				vscode.window.showInformationMessage(
					'The manifest.yaml file has been updated with schema information. Please reload the file.',
					'Reload'
				).then(selected => {
					if (selected === 'Reload') {
						vscode.commands.executeCommand('workbench.action.files.revert');
					}
				});
				break;
			}
		}
	} catch (error) {
		console.error('Error registering schema:', error);
	}
}

/**
 * Handle when a text document is opened to check if it's a manifest.yaml in a Dify directory
 * @param document The opened document
 */
function handleDocumentOpen(document: vscode.TextDocument): void {
	const fileName = path.basename(document.fileName);
	if (fileName !== 'manifest.yaml') {
		return;
	}
	
	const documentDir = path.dirname(document.fileName);
	
	// Check if this directory is a Dify directory by checking for .difyignore
	const difyIgnorePath = path.join(documentDir, '.difyignore');
	const mainPyPath = path.join(documentDir, 'main.py');
	
	if (fs.existsSync(difyIgnorePath) && fs.existsSync(mainPyPath)) {
		// This is a manifest.yaml in a Dify directory
		registerSchema(document.fileName);
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
	
	// Listen for document open events to handle manifest.yaml files
	const documentOpenListener = vscode.workspace.onDidOpenTextDocument(handleDocumentOpen);
	
	// Check any already open documents
	vscode.workspace.textDocuments.forEach(handleDocumentOpen);

	// Add the watchers to the subscriptions for cleanup when the extension deactivates
	context.subscriptions.push(
		workspaceWatcher,
		documentOpenListener
	);

	console.log('Dify Developer Kit activation complete.');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Dify Developer Kit extension is deactivating.');
}
