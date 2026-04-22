import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface ChubDoc {
  id: string;
  name: string;
  description?: string;
  content?: string;
  docsUrl?: string;
  localPath?: string;
  deprecatedMethods?: string[];
  replacementHints?: string[];
  source?: 'github' | 'chub' | 'local';
  metadata?: Record<string, unknown>;
}

/**
 * Wrapper for the Andrew Ng's Context Hub (chub) CLI.
 * It uses the @aisuite/chub package which is now a dependency.
 */
export class ChubWrapper {
  private binaryPath: string;

  constructor() {
    // Try to find the local node_modules binary first
    const localBin = path.join(process.cwd(), 'node_modules', '.bin', 'chub');
    const pkgBin = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'chub');
    
    if (fs.existsSync(localBin)) {
      this.binaryPath = localBin;
    } else if (fs.existsSync(pkgBin)) {
      this.binaryPath = pkgBin;
    } else {
      this.binaryPath = 'chub'; // Fallback to global
    }
  }

  /**
   * Search for documentation related to a specific API or library.
   */
  async search(query: string): Promise<ChubDoc[]> {
    try {
      const output = execSync(`${this.binaryPath} search "${query}" --format json`, { encoding: 'utf-8' });
      return JSON.parse(output);
    } catch (error) {
      // If the CLI doesn't support --format json yet, we might need to parse text
      // For now, let's assume it works or return empty
      return [];
    }
  }

  /**
   * Fetch detailed documentation for a specific ID.
   */
  async get(id: string): Promise<string | null> {
    try {
      const output = execSync(`${this.binaryPath} get ${id}`, { encoding: 'utf-8' });
      return output;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if the chub CLI is actually working.
   */
  isAvailable(): boolean {
    try {
      execSync(`${this.binaryPath} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
