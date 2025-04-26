import * as vscode from 'vscode';
import * as yaml from 'yaml';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from "ajv-formats"
import * as manifestSchema from './manifest.schema.json'; // Import the schema
import * as path from 'path';

// Create AJV instance
const ajv = new Ajv({ allErrors: true });
addFormats(ajv); // Add date-time format support

// Compile the schema
const validate = ajv.compile(manifestSchema);

/**
 * Finds the range for a given JSON path within a YAML document string.
 * This is a simplified approach and might not cover all edge cases perfectly,
 * especially with complex YAML structures, anchors, or aliases.
 * @param docText The full YAML text.
 * @param jsonPath The JSON path (e.g., /properties/name)
 * @returns The VS Code Range corresponding to the path, or a default range.
 */
function getRangeForPath(docText: string, jsonPath: string): vscode.Range {
    const pathSegments = jsonPath.split('/').slice(1); // Remove initial ''
    let currentLine = 0;
    let searchArea = docText;
    let currentIndent = -1;

    for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        const isIndex = /^\d+$/.test(segment); // Check if segment is an array index
        let regex;
        let searchFromLine = 0;

        // Look for the key (or index indicator) at the expected indentation level
        if (isIndex) {
            // For array indices, we look for the start of the item block (usually '-')
            // This is tricky as yaml.parse doesn't give direct line numbers for array items easily.
            // We'll approximate by finding the Nth '-' at the current indent.
            // Note: This is very basic and might fail on complex lists.
            regex = new RegExp(`^\s{${currentIndent + 2}}-\s`, 'm');
            let matchIndex = 0;
            let foundMatch: RegExpExecArray | null = null;
            let lastIndex = 0;
            while (matchIndex <= parseInt(segment) && (foundMatch = regex.exec(searchArea.substring(lastIndex))) !== null) {
                if (matchIndex === parseInt(segment)) {
                    searchFromLine = docText.substring(0, lastIndex + foundMatch.index).split('\n').length -1;
                    break;
                }
                lastIndex += foundMatch.index + foundMatch[0].length;
                matchIndex++;
            }
             if (!foundMatch) return new vscode.Range(currentLine, 0, currentLine, 0); // Fallback
        } else {
            // For object keys, look for "key:"
            regex = new RegExp(`^(\s*)(${segment}):`, 'm');
            const match = regex.exec(searchArea);
            if (!match) {
                // console.warn(`Path segment not found: ${segment} in path ${jsonPath}`);
                return new vscode.Range(currentLine, 0, currentLine, 0); // Fallback
            }
            const leadingWhitespace = match[1].length;
            const keyStartChar = leadingWhitespace;
            const keyEndChar = keyStartChar + segment.length;

             // Find the line number of the match
            const linesToMatch = docText.substring(0, docText.indexOf(match[0])).split('\n');
            searchFromLine = linesToMatch.length - 1;
            currentIndent = leadingWhitespace;
             // Update search area to be below the current key for next segments
            searchArea = docText.substring(docText.indexOf(match[0]) + match[0].length);
            currentLine = searchFromLine;
            // If it's the last segment, highlight the key itself
            if (i === pathSegments.length - 1) {
                 return new vscode.Range(currentLine, keyStartChar, currentLine, keyEndChar);
            }
        }
    }

    return new vscode.Range(currentLine, 0, currentLine, 0); // Default fallback
}

/**
 * Validates a manifest.yaml document against the schema.
 * @param document The VS Code TextDocument to validate.
 * @param diagnosticCollection The collection to add diagnostics to.
 * @param workspaceFolderUri The URI of the workspace folder containing the document.
 */
export async function validateManifest(
    document: vscode.TextDocument,
    diagnosticCollection: vscode.DiagnosticCollection,
    workspaceFolderUri: vscode.Uri | undefined
): Promise<void> {
    if (!workspaceFolderUri || !document.uri.fsPath.startsWith(workspaceFolderUri.fsPath)) {
        // Don't validate if it's not in the relevant workspace or workspace is undefined
        return;
    }
    if (path.basename(document.uri.fsPath) !== 'manifest.yaml') {
        return; // Only validate manifest.yaml files
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    try {
        const parsedYaml = yaml.parse(text);

        const isValid = validate(parsedYaml);

        if (!isValid && validate.errors) {
            validate.errors.forEach((error: ErrorObject) => {
                // console.log("Schema Error:", error);
                const jsonPath = error.instancePath; // e.g., /property/nestedProperty
                // Attempt to find a range - this is complex for YAML
                const range = getRangeForPath(text, jsonPath);

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `${error.message} (${jsonPath})`,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostics.push(diagnostic);
            });
        }
    } catch (error) {
        // Handle YAML parsing errors
        if (error instanceof yaml.YAMLParseError) {
            const position = error.pos ? document.positionAt(error.pos[0]) : new vscode.Position(0, 0);
            const endPosition = error.pos && error.pos.length > 1 ? document.positionAt(error.pos[1]) : position;
            const range = new vscode.Range(position, endPosition);
            const diagnostic = new vscode.Diagnostic(
                range,
                `YAML Parsing Error: ${error.message}`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
        } else if (error instanceof Error) {
             // Generic error
            const range = new vscode.Range(0, 0, 0, 0);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Validation Error: ${error.message}`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
        } else {
             // Unknown error type
             const range = new vscode.Range(0, 0, 0, 0);
             const diagnostic = new vscode.Diagnostic(
                 range,
                 `Unknown validation error.`,
                 vscode.DiagnosticSeverity.Error
             );
             diagnostics.push(diagnostic);
        }
    }

    // Update the diagnostics collection for this file
    diagnosticCollection.set(document.uri, diagnostics);
} 