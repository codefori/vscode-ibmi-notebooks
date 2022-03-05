import * as vscode from 'vscode';

//@ts-ignore
import * as mdTable from 'json-to-markdown-table';

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export default class IBMiController {
  readonly controllerId = 'ibmi-notebook-controller-id';
  readonly notebookType = 'ibmi-notebook';
  readonly label = 'IBM i Notebook';
  readonly supportedLanguages = ['sql', `cl`, `shellscript`];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;

  constructor() {
    this._controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._execute.bind(this);
  }

  public dispose() {
    this._controller.dispose();
  }

  private _execute(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): void {
    for (let cell of cells) {
      this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    const items: vscode.NotebookCellOutputItem[] = [];

    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now()); // Keep track of elapsed time to execute cell.

    switch (cell.document.languageId) {
      case 'sql':
        try {
          const table: Object[] = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, cell.document.getText())
          const keys = Object.keys(table[0]);

          // Add `-` for blanks.
          table.forEach(row => {
            keys.forEach(key => {
              //@ts-ignore
              if (row[key] === '') row[key] = `-`;
            });
          });

          items.push(vscode.NotebookCellOutputItem.text(mdTable(table, keys), `text/markdown`));
        } catch (e) {
          //@ts-ignore
          items.push(vscode.NotebookCellOutputItem.stderr(e.message));
        }
        break;

      case `cl`: 
        try {
          const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: cell.document.getText(),
            environment: `ile`
          });

          if (command.stdout) {
            items.push(vscode.NotebookCellOutputItem.text([
              '```',
              command.stdout,
              '```'
            ].join('\n'), `text/markdown`));
          }

          if (command.stderr) {
            items.push(vscode.NotebookCellOutputItem.text([
              '```',
              command.stderr,
              '```'
            ].join('\n'), `text/markdown`));
          }
        } catch (e) {
          items.push(
            vscode.NotebookCellOutputItem.stderr(`Failed to runCommand. Are you connected?`),
            //@ts-ignore
            vscode.NotebookCellOutputItem.stderr(e.message)
          );
        }
        break;

      case `shellscript`: 
        try {
          const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: cell.document.getText(),
            environment: `pase`
          });

          if (command.stdout) {
            items.push(vscode.NotebookCellOutputItem.text([
              '```',
              command.stdout,
              '```'
            ].join('\n'), `text/markdown`));
          }

          if (command.stderr) {
            items.push(vscode.NotebookCellOutputItem.text([
              '```',
              command.stderr,
              '```'
            ].join('\n'), `text/markdown`));
          }
        } catch (e) {
          items.push(
            vscode.NotebookCellOutputItem.stderr(`Failed to runCommand. Are you connected?`),
            //@ts-ignore
            vscode.NotebookCellOutputItem.stderr(e.message)
          );
        }
        break;
    }

    execution.replaceOutput([
      new vscode.NotebookCellOutput(items)
    ]);

    execution.end(true, Date.now());
  }
}