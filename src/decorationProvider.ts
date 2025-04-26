import * as vscode from 'vscode';
import * as path from 'path';

export class DifyManifestDecorationProvider implements vscode.FileDecorationProvider {

    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    // Store the URIs of confirmed Dify directories
    private difyDirectories: Set<string> = new Set();

    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        // Check if the file is manifest.yaml
        if (path.basename(uri.fsPath) !== 'manifest.yaml') {
            return undefined; // No decoration for other files
        }

        // Check if the file is inside a known Dify directory
        const parentDir = path.dirname(uri.toString());
        if (this.difyDirectories.has(parentDir)) {
            // console.log(`Decorating: ${uri.toString()} in ${parentDir}`);
            return new vscode.FileDecoration(
                '🧩', // or use a character like 'D' or an icon character
                'Dify Tool Manifest File' // Tooltip
            );
        } else {
            // console.log(`Skipping decoration for: ${uri.toString()}, parent ${parentDir} not in Set`, this.difyDirectories);
        }

        return undefined;
    }

    /**
     * Update the set of known Dify directories.
     * @param directoryUris An iterable of directory URIs (as strings).
     */
    updateDifyDirectories(directoryUris: Iterable<string>): void {
        this.difyDirectories = new Set(directoryUris);
        // console.log("Updated Dify Directories in Provider:", this.difyDirectories);
        // We need to trigger updates for potentially affected manifest files
        // However, efficiently finding *which* manifest files needs more complex logic
        // Triggering undefined forces VS Code to re-evaluate all visible decorations
        this._onDidChangeFileDecorations.fire(undefined);
    }

    /**
     * Add a single Dify directory URI.
     */
    addDifyDirectory(dirUriString: string): void {
        if (!this.difyDirectories.has(dirUriString)) {
            this.difyDirectories.add(dirUriString);
            // console.log("Added Dify Directory:", dirUriString, " New Set:", this.difyDirectories);
            this._onDidChangeFileDecorations.fire(undefined); // Update decorations
        }
    }

    /**
     * Remove a single Dify directory URI.
     */
    removeDifyDirectory(dirUriString: string): void {
        if (this.difyDirectories.has(dirUriString)) {
            this.difyDirectories.delete(dirUriString);
            // console.log("Removed Dify Directory:", dirUriString, " New Set:", this.difyDirectories);
            this._onDidChangeFileDecorations.fire(undefined); // Update decorations
        }
    }

     /**
     * Manually trigger decoration updates for specific URIs or all.
     */
    triggerUpdate(uris?: vscode.Uri | vscode.Uri[]): void {
        this._onDidChangeFileDecorations.fire(uris);
    }
} 