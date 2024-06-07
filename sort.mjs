import fs from "fs";
import path from "path";
import readline from "readline";

"use strict";

/* ОБЪЕКТ КОНФИГУРАЦИИ. ИЗМЕНЯЕТСЯ НАПРЯМУЮ ИЛИ ПАРАМЕТРАМИ CLI */
var config = {
    temp_dir: path.join("dataset", "temp"),
    input_filepath: path.join("dataset", "input"),
    output_filepath: path.join("dataset", "output"),
    max_storage: 200000
}

{
    let argname = "";
    for (let arg of process.argv.slice(2)) {
        if (argname == "--output") {
            config.output_filepath = arg;
        }
        else if (argname == "--input") {
            config.input_filepath = arg;
        }
        else if (argname == "--max_storage") {
            config.max_storage = Number(arg);
        }
        else if (argname == "--temp_dir") {
            config.temp_dir = arg;
        }
        argname = arg;
    }
}

async function sortFile(temp_dir, input_filepath, output_filepath, max_storage, compare_func) {
    function log(message) {
        if (allow_log) console.log(message + ": " + new Date(new Date().toUTCString()));
    }

    async function removeAllFilesAsync(directory) {
        fs.readdir(directory, (err, files) => {
            if (err) {
                return;
            }

            files.forEach((file) => {
                const filePath = path.join(directory, file);
                fs.unlink(filePath, (err) => { });
            });
        });
    }
    const allow_log = true;
    const occupied_count = Math.floor(0.8 * max_storage);

    log(`Начало обработки файла`);

    // Очистка директории временных файлов
    await removeAllFilesAsync(temp_dir);

    // Очистка файла результата
    fs.writeFile(output_filepath, '', () => { });

    log("Начало разделения файла на чанки");
    // Разделение input_filepath файла на отсортированные chunk'и по max_storage строк
    // В конце выполнения fileIndex будет равен количеству батчей
    var fileIndex = 0;
    {
        // Тут используется стрим для предотвращения утечки
        const fileStream = fs.createReadStream(input_filepath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        let counter = 0;
        let chunk = [];

        for await (const line of rl) {
            counter++;
            chunk.push(line);

            if (counter == max_storage) {
                chunk.sort((a, b) => compare_func(a, b));

                chunk.forEach((line) => {
                    fs.appendFileSync(path.join(temp_dir,
                        `chunk${fileIndex}`),
                        line + "\n", () => { });
                });

                chunk = [];
                counter = 0;
                fileIndex++;
            }
        }

        fileStream.close();
    }
    log("Окончание разделения файла на чанки");

    // Максимальный размер выгрузки одного batch'а из chunk'а
    const max_batch_size = Math.floor(occupied_count / fileIndex);
    // Максимальный размер буфера отсортированных строк для сохранения
    const free_space_size = max_storage - occupied_count;

    log("Начало сортировки всех чанков");
    // Выгрузка частей chunk'ов в batch'и в словарь для последующей сортировки
    {
        // Функция заполнение массива батчей строками
        async function fillBathes() {
            for (let i = 0; i < fileIndex; i++) {
                // Тут используется стрим для предотвращения утечки
                const fileStream = fs.createReadStream(
                    path.join(temp_dir, `chunk${i}`),
                    { highWaterMark: 1000 });
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });

                let line_counter = -1;
                for await (const line of rl) {
                    line_counter++;
                    if (line_counter < batches[i].last_line) {
                        continue;
                    }
                    batches[i].lines.push(line);
                    batches[i].last_line++;

                    if (batches[i].lines.length == max_batch_size) {
                        break;
                    }
                }

                fileStream.close();
            }
        }

        // Инициализация массива батчей
        let batches = [];
        for (let i = 0; i < fileIndex; i++) {
            batches.push({
                lines: [],
                last_line: 0,
            });
        }
        let free_space_lines = [];

        // Первичное заполение
        await fillBathes();

        // Последовательная выгрузка частей батчей с последующим поиском минимальной строки 
        while (true) {
            function writeToOutputStream(line, stream) {
                return new Promise((resolve, reject) => {
                    stream.write(line + '\n', (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            };


            let min_line_index = 0;
            let min_line = null;

            // проход по батчам для выявления самой меньшей строки
            for (let index in batches) {
                if (batches[index].lines.length == 0) {
                    batches[index].lines = [];
                    continue;
                }

                if (min_line == null) {
                    min_line = batches[index].lines[0];
                }
                else if (compare_func(min_line, batches[index].lines[0])) {
                    min_line = batches[index].lines[0];
                    min_line_index = index;
                }
            }

            // если все батчи пустые
            if (batches.every(batch => !batch.lines.length)) {
                // попробовать заполнить их снова
                await fillBathes();
                if (batches.every(batch => !batch.lines.length)) {
                    break;
                }
            }
            else {
                batches[min_line_index].lines = batches[min_line_index].lines.slice(1);
                free_space_lines.push(min_line);

                if (free_space_lines.length == free_space_size) {
                    fs.appendFileSync(config.output_filepath, free_space_lines.join("\n") + "\n");
                    free_space_lines = [];
                }
            }
        }
    }

    await removeAllFilesAsync(temp_dir);
    log("Конец обработки");
}

sortFile(...Object.values(config), function compareStrings(a, b) {
    return a.toLowerCase().localeCompare(b.toLowerCase());
});