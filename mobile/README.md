# Xello Tuition Mobile App (React Native & Expo)

A cross-platform mobile application for **Xello Tuition**, specifically tailored for **Academic Trainers** and **Students / Parents**.

---

## 📱 Features

### 👨‍🏫 Trainer Portal
- **Dashboard**: Today's scheduled classes, assigned students count, and completed teaching hours.
- **My Students**: Restricted, subject-specific view displaying only students and credits assigned to the trainer.
- **Weekly Schedule**: Complete weekly timetable with IST slots and subject tags.
- **Manual Attendance Marking**:
  - Mark student Present, Late, or Absent.
  - Record class outcome, actual duration, topic covered, homework, and progress notes.
  - Instantly deducts class credit from student package and logs trainer working hours.
- **Trainer Profile**: Account details, assigned subjects, and session guidelines.

### 🎓 Student & Parent Portal
- **Dashboard**:
  - Real-time **Package Class Balance** (Remaining vs Attended classes with visual progress bar).
  - Next upcoming scheduled class alert with trainer name.
  - Recent class topics covered & assigned homework.
- **Class History**: Comprehensive log of all attended classes, trainer progress feedback, and homework notes.
- **Weekly Timetable**: View recurring weekly classes by day with subject colors and trainer names.
- **Student Profile**: Grade, board (CBSE), syllabus details, and registered guardian contact.

---

## 🚀 Getting Started

### 1. Install Dependencies
From the `mobile/` directory:
```bash
cd mobile
npm install
```

### 2. Run with Expo
Start the development server:
```bash
npx expo start
```

- **Run on Android Emulator**: Press `a` in the terminal or run `npm run android`
- **Run on iOS Simulator**: Press `i` in the terminal or run `npm run ios`
- **Run on Physical Phone**: Download **Expo Go** from Google Play Store or Apple App Store and scan the QR code displayed in the terminal.

---

## 🌐 Backend API Configuration

The mobile app connects to the Next.js backend API at:
- **Production**: `https://xellotuition.com`
- **Local Development**:
  - iOS Simulator: `http://localhost:3000`
  - Android Emulator: `http://10.0.2.2:3000`
  - Physical Device: Use your machine's local IP address (e.g. `http://192.168.1.X:3000`)

To change the API URL, edit `mobile/src/config/api.ts`.

---

## 📦 Building Standalone APK / iOS IPA

Using **Expo Application Services (EAS)**:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to Expo:
   ```bash
   eas login
   ```
3. Configure project:
   ```bash
   eas build:configure
   ```
4. Build APK for Android:
   ```bash
   eas build -p android --profile preview
   ```
5. Build iOS App:
   ```bash
   eas build -p ios --profile preview
   ```
