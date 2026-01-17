import * as fs from 'fs';

export class FontFinder {
    private static readonly possibleFontPaths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        '/System/Library/Fonts/Helvetica.ttc'
    ];

    static findFontFiles(): string[] {
        const fontFiles: string[] = [];

        for (const fontPath of this.possibleFontPaths) {
            try {
                if (fs.existsSync(fontPath)) {
                    fontFiles.push(fontPath);
                    break;
                }
            } catch (e) {
            }
        }

        return fontFiles;
    }
}
