import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitExtension, Repository } from './git';

interface ExtensionConfig {
	commitMessagePrefixPattern: RegExp;
	commitMessageFormat: string;
	gitHeadWatchInterval: number;
	outdatedPrefixPattern: RegExp;
}

function getExtensionConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration('jira-commit-message');
	const tagPattern = config.get<string>('commitMessagePrefixPattern', '(ML-\\d+)-.*');
	const msgFormat = config.get<string>("commitMessageFormat", "[${prefix}] ${message}");

	const match = tagPattern.match(/\(([^)]+)\)/);
	const prefixPattern = match ? match[1] : tagPattern;
	const outdatedPrefixPattern: string = msgFormat
		.replace('${prefix}', `(${prefixPattern})`)
		.replace('${message}', '(.*)')
		.replace(/[\[\]]/g, '\\$&')
		.replace(/\$/g, '\\$');

	return {
		commitMessagePrefixPattern: new RegExp(tagPattern),
		commitMessageFormat: msgFormat,
		outdatedPrefixPattern: new RegExp(outdatedPrefixPattern),
		gitHeadWatchInterval: config.get<number>('gitHeadWatchInterval', 1000),
	};
}

function updateCommitMessage(repo: Repository) {
	const config = getExtensionConfig();
	const branch: string = repo.state.HEAD?.name ?? "";

	if (config.outdatedPrefixPattern.test(repo.inputBox.value)) {
		repo.inputBox.value = repo.inputBox.value.replace(config.outdatedPrefixPattern, "$2");
	}

	repo.inputBox.value = getCommitMessage(branch, repo.inputBox.value, config);
}

function getCommitMessage(branch: string, currentMessage: string, config: ExtensionConfig): string {
	if (!config.commitMessagePrefixPattern.test(branch)) {
		return currentMessage;
	}

	const prefixMatch = branch.match(config.commitMessagePrefixPattern);
	if (!prefixMatch) { return currentMessage; }

	const prefix = prefixMatch[1];
	const formattedMessage = config.commitMessageFormat
		.replace('${prefix}', prefix)
		.replace('${message}', currentMessage);

	return formattedMessage;
}


export function activate(context: vscode.ExtensionContext): void {
	const gitExtension: GitExtension | undefined = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
	if (!gitExtension) {
		vscode.window.showErrorMessage("Unable to load the Git extension");
		return;
	}
	const git = gitExtension.getAPI(1);
	const config = getExtensionConfig();

	git.repositories.forEach(repo => {
		repo.state.onDidChange(_ => {
			updateCommitMessage(repo);
		});

		updateCommitMessage(repo);
	});
	context.subscriptions.push(vscode.commands.registerCommand('jira-commit-message.update-message', async (uri?) => {
		git.repositories.forEach(updateCommitMessage);
	}));
}

export function deactivate(): void { }
