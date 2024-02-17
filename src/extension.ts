import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitExtension, Repository } from './git';



function getCommitMessage(branch: string, currentMessage: string): string {
	const pattern = /(ML-\d+)-.*/;

	if (!pattern.test(branch)) {
		return currentMessage;
	}

	const prefix = branch.match(pattern)![1];

	if (currentMessage.startsWith(prefix)) {
		return currentMessage;
	}

	return `[${prefix}] ${currentMessage}`;
}

function updateCommitMessage(repo: Repository) {
	const branch = repo.state.HEAD?.name ?? "";

	const existingPattern = /^\[.+\] ?(.*)/;

	if (existingPattern.test(repo.inputBox.value)) {
		repo.inputBox.value = repo.inputBox.value.replace(existingPattern, "$1");
	}

	repo.inputBox.value = getCommitMessage(branch, repo.inputBox.value);
}

export function activate(context: vscode.ExtensionContext) {
	const gitExtension: GitExtension | null = vscode.extensions.getExtension('vscode.git')?.exports;
	if (!gitExtension) {
		vscode.window.showErrorMessage("Unable to load the Git extension");
		return;
	}
	const git = gitExtension.getAPI(1);

	for (const repo of git.repositories) {
		updateCommitMessage(repo);

		const gitHeadPath: string = path.join(repo.rootUri.fsPath, '.git', 'HEAD');
		vscode.window.showInformationMessage("Watching " + gitHeadPath);

		try {
			fs.watchFile(gitHeadPath, { interval: 1000 }, (cur, prev) => {
				updateCommitMessage(repo);
			});
		} catch (error) {
			vscode.window.showErrorMessage('Error watching .git/HEAD: ' + error);
		}
	}
}

export function deactivate() { }
