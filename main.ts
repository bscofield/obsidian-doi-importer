import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface DoiImporterSettings {
	referenceNotePath: string;
}

const DEFAULT_SETTINGS: DoiImporterSettings = {
	referenceNotePath: '/references'
}

export default class DoiImporter extends Plugin {
	settings: DoiImporterSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'import-doi',
			name: 'Import reference from DOI',
			hotkeys: [
				{
					modifiers: ['Meta', 'Shift'],
					key: 'i',
				},
			],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const doi = editor.getSelection()

				// validate that it's a DOI
				console.log(`Fetching metadata for ${doi}`)

				// get the metadata for the DOI
				const url = `https://api.crossref.org/works/${doi}`
				try {
					const data = fetch(url)
					.then(response => response.json())
					.then(data => {
						const metadata = data.message;

						const notePath = `${this.settings.referenceNotePath}/${metadata.title}.md`
						const firstAuthor = metadata.author[0].family.toLowerCase()

						const year = metadata.created['date-parts'][0][0]
						const alias = `${firstAuthor}${year}`

						const authors = metadata.author.map((author: any) => {
							return `${author.given} ${author.family}`
						}).join(', ')

						const contents = {
							title: metadata.title[0],
							authors,
							year,
							journal: metadata['container-title'][0],
							volume: metadata.volume,
							issue: metadata.issue,
							page: metadata.page,
							doi: metadata.DOI,
							url: metadata.URL
						}

						// create the note
							const note = `# ${contents.title}

- Author: ${contents.authors}
- Year: ${contents.year}
- Journal: ${contents.journal}
- Pages: ${contents.page}
- DOI: ${contents.doi}
- URL: ${contents.url}

## Summary

TK
`;

						// if note doesn't exist, create it
						if (!this.app.vault.getAbstractFileByPath(notePath)) {
							this.app.vault.create(notePath, note).then((file) => {
								this.app.fileManager.processFrontMatter(file, (frontmatter) => {
									frontmatter.aliases = [alias, contents.doi]
								})
							})

							// replace the selection with the note link
							const link = `[[${contents.title}|${contents.doi}]]`
							editor.replaceSelection(link)
						} else {
							new Notice('Note already exists')
						}
					}
				)
				} catch (error) {
					console.error(error)
					// notice
					new Notice('Error fetching metadata')
				}
			}

		});


		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DoiImporterSettingsTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class DoiImporterSettingsTab extends PluginSettingTab {
	plugin: DoiImporter;

	constructor(app: App, plugin: DoiImporter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Reference Note Path')
			.setDesc('Where would you like to save reference notes?')
			.addText(text => text
				.setPlaceholder('Enter the path')
				.setValue(this.plugin.settings.referenceNotePath)
				.onChange(async (value) => {
					this.plugin.settings.referenceNotePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
