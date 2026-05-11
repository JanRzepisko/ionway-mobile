# IONWAY Mobile

Aplikacja mobilna audytowa offline-first dla tabletów Android/iOS.

## Architektura Offline-First

Aplikacja została zaprojektowana do pracy bez połączenia z internetem:

1. **Pobieranie danych** - gdy internet jest dostępny, pobierz dane z serwera
2. **Lokalna baza danych** - wszystkie dane przechowywane w SQLite
3. **Praca offline** - filtrowanie, formularze, zapis odpowiedzi bez internetu
4. **Synchronizacja** - wyślij dane po odzyskaniu połączenia

## Wymagania

- Node.js 18+
- Expo CLI
- Android Studio (dla Android)
- Xcode (dla iOS, macOS)

## Uruchomienie

```bash
cd mobile
npm install
npx expo start
```

## Struktura projektu

```
mobile/
├── App.tsx                      # Główny komponent aplikacji
├── src/
│   ├── database/                # Lokalna baza SQLite
│   │   ├── schema.ts           # Schemat bazy danych
│   │   ├── projects.ts         # Operacje na projektach
│   │   ├── devices.ts          # Operacje na urządzeniach
│   │   ├── formConfig.ts       # Konfiguracja formularzy
│   │   ├── audits.ts           # Sesje i odpowiedzi audytowe
│   │   └── index.ts            # Eksporty
│   ├── services/
│   │   ├── api.ts              # Klient API
│   │   └── syncService.ts      # Synchronizacja download/upload
│   ├── stores/                  # Stan aplikacji (Zustand)
│   │   ├── authStore.ts        # Autoryzacja
│   │   ├── projectStore.ts     # Projekty i urządzenia
│   │   └── auditStore.ts       # Sesja audytowa
│   ├── components/
│   │   ├── ui/                 # Komponenty UI
│   │   ├── forms/              # Dynamiczny renderer formularzy
│   │   ├── filters/            # Filtry urządzeń
│   │   └── sync/               # Komponenty synchronizacji
│   ├── screens/                 # Ekrany aplikacji
│   │   ├── LoginScreen.tsx
│   │   ├── ProjectsScreen.tsx
│   │   ├── DevicesScreen.tsx
│   │   ├── AuditFormScreen.tsx
│   │   ├── AddDeviceScreen.tsx
│   │   └── SyncScreen.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Nawigacja
│   ├── theme/
│   │   └── index.ts            # Design system
│   └── types/
│       └── index.ts            # Typy TypeScript
└── package.json
```

## Baza danych lokalna (SQLite)

### Tabele

| Tabela | Opis |
|--------|------|
| `projects` | Projekty |
| `devices` | Urządzenia |
| `form_tabs` | Zakładki formularzy |
| `form_fields` | Pola formularzy |
| `option_sets` | Zestawy opcji |
| `option_values` | Wartości opcji |
| `audit_sessions` | Sesje audytowe |
| `audit_answers` | Odpowiedzi audytowe |
| `sync_queue` | Kolejka synchronizacji |
| `sync_state` | Stan synchronizacji |
| `current_user` | Zalogowany użytkownik |

### Status synchronizacji

- `local_only` - zapisano lokalnie, nigdy nie synchronizowano
- `pending_upload` - gotowe do wysłania
- `uploading` - w trakcie wysyłania
- `synced` - zsynchronizowano z serwerem
- `upload_error` - błąd wysyłki
- `conflict` - konflikt danych

## Dynamiczne formularze

Formularze nie są zakodowane na sztywno. Są renderowane dynamicznie na podstawie:

- `form_tabs` - zakładki formularza
- `form_fields` - pola formularza
- `option_sets` / `option_values` - opcje odpowiedzi

### Typy pól

| Typ | Opis |
|-----|------|
| `text` | Pole tekstowe |
| `textarea` | Pole tekstowe wieloliniowe |
| `number` | Pole numeryczne |
| `select` | Lista wyboru (chips) |
| `radio` | Przyciski radio |
| `checkbox` | Checkboxy |
| `slider` | Suwak procentowy |
| `readonly_info` | Informacja tylko do odczytu |

## Filtrowanie kaskadowe

Filtry urządzeń działają kaskadowo (offline):

```
Budynek → Poziom → Strefa → System → Grupa → Typ
```

Każdy kolejny filtr zawęża dostępne opcje na podstawie wcześniejszych wyborów.

## Synchronizacja

### Download (pobieranie)

```
POST /mobile/projects/:projectId/download
```

Pobiera:
- Dane projektu
- Konfigurację formularzy (tabs, fields, option sets)
- Listę urządzeń

### Upload (wysyłanie)

```
POST /mobile/projects/:projectId/upload
```

Wysyła:
- Nowe urządzenia dodane offline
- Sesje audytowe
- Odpowiedzi audytowe

## Design System

### Kolory

| Nazwa | Wartość | Użycie |
|-------|---------|--------|
| Primary | `#0285c6` | Główny kolor |
| Primary Light | `#e6f3fa` | Tło |
| Primary Dark | `#015177` | Ciemny akcent |
| Success | `#10b981` | Sukces |
| Warning | `#f59e0b` | Ostrzeżenie |
| Error | `#ef4444` | Błąd |

### Wygląd

- Duże przyciski dla tabletu
- Czytelna typografia
- Karty z cieniami
- Profesjonalne ikony (MaterialCommunityIcons)
- Brak emoji

## Technologie

- **React Native** - framework mobilny
- **Expo** - platforma deweloperska
- **expo-sqlite** - lokalna baza danych
- **Zustand** - zarządzanie stanem
- **React Navigation** - nawigacja
- **React Native Paper** - komponenty UI
- **Axios** - klient HTTP

## Główne funkcje

1. **Logowanie** - autentykacja JWT
2. **Wybór projektu** - lista dostępnych projektów
3. **Pobieranie danych** - synchronizacja z serwerem
4. **Filtrowanie urządzeń** - kaskadowe filtry offline
5. **Audyt urządzenia** - dynamiczny formularz
6. **Auto-zapis** - automatyczny zapis odpowiedzi
7. **Dodawanie urządzeń** - tworzenie offline
8. **Wysyłanie danych** - synchronizacja do serwera
9. **Status synchronizacji** - widoczny stan
