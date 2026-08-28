# Hobby Habit Tracker

Простой React-трекер хобби и привычек: привычки идут строками, дни идут
колонками, а клик по ячейке открывает оценку выполнения от 1 до 5.

## Что уже есть

- добавление новой привычки или хобби;
- отметка выполнения оценкой 1-5;
- цвет ячейки зависит от оценки;
- скрытие привычки из таблицы;
- статистика по количеству привычек, отметок и средней оценке;
- локальное сохранение в браузере;
- Firebase Auth + Firestore для синхронизации данных между телефоном и
  компьютером, когда заданы переменные `VITE_FIREBASE_*`;
- сборка как статический сайт для GitHub Pages.

## Запуск

```bash
npm install
npm run dev
```

## Сборка для GitHub Pages

```bash
npm run build
```

Готовые файлы появятся в папке `dist/`.

В этом проекте GitHub Pages публикуется из ветки `gh-pages`, а не из `main`.
Для публикации используется отдельная статическая сборка.

Опубликовать актуальную версию на GitHub Pages:

```bash
npm run deploy:pages
```

Эта команда:

- собирает проект;
- обновляет ветку `gh-pages` содержимым `dist/`;
- пушит публикацию в `origin/gh-pages`.

Важно:

- исходный код живёт в `main`, `dev` и `feature/*`;
- ветка `gh-pages` хранит только опубликованные статические файлы;
- папка `dist/server/` нужна для Sites, но не должна попадать в GitHub Pages.

## Ветки и процесс

- `main` - стабильный исходный код, готовый к публикации;
- `dev` - ветка интеграции для продолжающейся разработки;
- `feature/*` - короткоживущие ветки под отдельные задачи;
- `gh-pages` - только опубликованный статический сайт, без ручной разработки.

Рекомендуемый порядок:

1. Работать в `feature/*`.
2. Сливать в `dev`.
3. После проверки переносить в `main`.
4. Публиковать GitHub Pages командой `npm run deploy:pages`.
5. Sites публиковать отдельно из актуального `main`.

## Коммиты и версии

Для истории проекта используем простой и читаемый формат коммитов:

- `feat(scope): ...` — новая функция;
- `fix(scope): ...` — исправление;
- `chore(scope): ...` — внутренняя организационная правка;
- `refactor(scope): ...` — перестройка кода без смены внешнего поведения.

Примеры:

- `feat(tracker): add day notes`
- `fix(auth): add redirect fallback for mobile sign-in`
- `fix(pages): publish latest stable build`
- `chore(repo): standardize branching workflow`

Версию продукта держим в `package.json` и обновляем по простому правилу:

- `patch` — маленькие исправления и UX-улучшения;
- `minor` — новые пользовательские возможности;
- `major` — крупные несовместимые изменения.

История заметных изменений хранится в [CHANGELOG.md](./CHANGELOG.md).

## Firebase

Пока Firebase-настройки не заданы, приложение работает локально в текущем
браузере.
Чтобы включить синхронизацию:

1. Создай Firebase-проект.
2. Включи Google Sign-In в Firebase Authentication.
3. Создай Firestore Database.
4. Скопируй `.env.example` в `.env`.
5. Заполни переменные `VITE_FIREBASE_*` из настроек Web App в Firebase.
6. В Firebase Authentication добавь authorized domain `iveivs.github.io`.
7. В GitHub репозитории добавь такие же значения в Settings -> Secrets and
   variables -> Actions -> Repository secrets.

Для GitHub Pages нужны repository secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Приложение хранит данные в Firestore по пути:

```text
users/{userId}/tracker/state
```

Минимальные правила Firestore для личных данных:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/tracker/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
