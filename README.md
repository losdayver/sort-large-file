# Сортировка больших файлов строк с помощью алгоритма external-merge-sort

## Как пользовать?

### Быстрый старт:

```Bash
mkdir dataset/temp/; node sort.mjs --input dataset/examples/random --output dataset/output --max_storage 2000
```

### Для сортировки необходимо воспользоваться следующим синтаксисом:

```Bash
node sort.mjs --input <путь_до_исходного_файла> --output <путь_до_результирующего_файла> --max_storage <количество_строк_в_оперативной_памяти> --temp_dir <директория_временных_файлов>
```

### Для генерации файла со случайными строками можно воспользоваться скриптом _generate_dataset.js_:

```Bash
node generate_dataset.js
```

В директории dataset/examples приложены тестовые файлы для сортировки.
