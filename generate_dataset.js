const fs = require('fs');
const path = require('path');

function fillFile(filename, num_strings) {
    const allow_log = true;

    function log(message) {
        if (allow_log) console.log(message + ": " + new Date(new Date().toUTCString()));
    }

    log(`Начало генерации файла в ${num_strings} строк`);

    fs.writeFile(filename, '', () => { });

    const charset = 'abcdefghijklmnopqrstuvwxyz1234567890';

    function generateRandomString(length) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset[Math.floor(Math.random() * charset.length)];
        }
        return result;
    }

    for (var i = 0; i < num_strings; i++) {
        if (i % (num_strings / 100) == 0) {
            log(`Завершено: ${(100 * i / num_strings).toFixed(0)}% `);
        }
        fs.appendFileSync(filename, generateRandomString(30) + `\n`);
    }
    log(`Завершено: ${(100 * i / num_strings).toFixed(0)}% `);

    log("Конец генерации файла");
}

try {
    fs.mkdirSync(path.join("dataset", "temp"), { recursive: true });
} catch { }
fillFile(path.join("dataset", "input"), 20000);
