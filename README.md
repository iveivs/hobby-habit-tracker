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
- заготовка для Firebase Auth + Firestore, чтобы синхронизировать данные между
  телефоном и компьютером;
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

Готовые файлы появятся в папке `dist/`. Их можно публиковать через GitHub
Pages, например из GitHub Actions.

В проект уже добавлен workflow `.github/workflows/deploy.yml`. После загрузки
репозитория на GitHub включи Pages в режиме GitHub Actions.

## Firebase

Пока файл `.env` не создан, приложение работает локально в текущем браузере.
Чтобы включить синхронизацию:

1. Создай Firebase-проект.
2. Включи Google Sign-In в Firebase Authentication.
3. Создай Firestore Database.
4. Скопируй `.env.example` в `.env`.
5. Заполни переменные `VITE_FIREBASE_*` из настроек Web App в Firebase.

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
