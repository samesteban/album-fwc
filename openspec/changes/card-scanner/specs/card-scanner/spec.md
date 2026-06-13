# Card Scanner Specification

## Purpose

Define the behavior of the camera-based OCR scanner for sticker card code detection, status lookup, and one-tap state updates. The scanner runs entirely client-side using Tesseract.js in a Web Worker and integrates with the existing localStorage collection state.

## Requirements

### Requirement: Camera Access

The system MUST request access to the rear-facing camera via `navigator.mediaDevices.getUserMedia` when the user navigates to the Intercambios tab.

#### Scenario: Camera permission granted

- GIVEN the user is on the Intercambios screen for the first time
- WHEN the system calls `getUserMedia({ video: { facingMode: "environment" } })`
- THEN the live video feed SHALL display full-screen
- AND the viewfinder overlay SHALL appear centered

#### Scenario: Camera permission denied

- GIVEN the user is on the Intercambios screen
- WHEN the browser denies camera permission
- THEN the system SHALL display a clear error message with instructions to enable camera access in browser settings
- AND the scanner SHALL NOT start

#### Scenario: Camera unavailable on device

- GIVEN the user is on the Intercambios screen
- WHEN no camera is available (e.g., desktop without webcam)
- THEN the system SHALL display a fallback message indicating the device does not support camera scanning

### Requirement: Auto-Capture Loop

The system MUST automatically capture video frames at approximately 500ms intervals without requiring user interaction. There SHALL be no trigger button.

#### Scenario: Frame capture interval

- GIVEN the camera stream is active and the scanner is in "scanning" state
- WHEN 500ms have elapsed since the last frame capture
- THEN the system SHALL capture the current video frame to an offscreen canvas
- AND SHALL send the ImageData to the OCR Web Worker for processing

#### Scenario: Capture stops on match

- GIVEN the auto-capture loop is running
- WHEN a valid sticker code is detected
- THEN the system SHALL stop capturing new frames
- AND SHALL freeze the video feed on the matched frame

#### Scenario: Capture resumes on "Siguiente"

- GIVEN the scanner is in "frozen" state after a match
- WHEN the user taps "Siguiente"
- THEN the system SHALL resume the auto-capture loop
- AND SHALL clear the previous scan result

### Requirement: OCR Processing in Web Worker

All Tesseract.js OCR processing MUST execute in a dedicated Web Worker to prevent blocking the main thread.

#### Scenario: Worker receives frame data

- GIVEN the OCR Web Worker is initialized
- WHEN the scanner sends ImageData via postMessage
- THEN the worker SHALL run Tesseract.recognize() on the received image data
- AND SHALL apply regex post-processing: `^[A-Z]{2,3} \d{1,2}$`
- AND SHALL return `null` if no valid match, or an object `{ raw: string, sectionCode: string, number: string }` if matched

#### Scenario: Worker receives "00" code

- GIVEN the OCR worker receives a frame
- WHEN the recognized text is "FWC 00" or "CC 00" or similar
- THEN the worker SHALL accept "00" as a valid number despite it not matching `\d{1,2}` directly
- AND SHALL validate it only for the FWC section (number range 00, 1-19)

### Requirement: Regex Code Validation

The system MUST validate OCR output against a strict regex pattern before accepting it as a valid scan.

#### Scenario: Valid code accepted

- GIVEN the OCR worker recognizes text "ESP 5"
- WHEN the regex `/^([A-Z]{2,3}) (\d{1,2})$/` is applied
- THEN the result SHALL be accepted as valid
- AND the system SHALL parse sectionCode="ESP" and number="5"

#### Scenario: Invalid format rejected

- GIVEN the OCR worker recognizes garbled text "es p 5" or "ESP5" or "ESP 500"
- WHEN the regex validation is applied
- THEN the result SHALL be rejected
- AND the scanner SHALL continue capturing frames

#### Scenario: Invalid section code rejected

- GIVEN the OCR worker recognizes "XYZ 5"
- WHEN the section code "XYZ" is checked against known section IDs
- THEN the result SHALL be rejected
- AND the scanner SHALL continue capturing frames

### Requirement: Number Range Validation

The system MUST validate that the detected number falls within the valid range for the detected section.

#### Scenario: Valid team card number

- GIVEN the OCR parsed sectionCode="ARG" and number="15"
- WHEN the system checks ARG is a team section (valid range 1-20)
- THEN number 15 SHALL be accepted

#### Scenario: Out of range team number

- GIVEN the OCR parsed sectionCode="MEX" and number="21"
- WHEN the system checks MEX is a team section (valid range 1-20)
- THEN number 21 SHALL be rejected

#### Scenario: Valid FWC special number

- GIVEN the OCR parsed sectionCode="FWC" and number="00"
- WHEN the system checks FWC special section (valid range 00, 1-19)
- THEN number "00" SHALL be accepted

#### Scenario: Valid CC number

- GIVEN the OCR parsed sectionCode="CC" and number="10"
- WHEN the system checks CC section (valid range 1-14)
- THEN number 10 SHALL be accepted

### Requirement: Freeze Frame on Match

When a valid code is detected, the live video feed MUST freeze immediately to prevent further scanning.

#### Scenario: Video pauses on detection

- GIVEN the auto-capture loop is active
- WHEN a valid sticker code is validated
- THEN the video stream SHALL be paused (not stopped)
- AND the viewfinder frame SHALL remain visible
- AND the overlay card SHALL appear

### Requirement: Viewfinder Color Feedback

The viewfinder border/frame color MUST change based on the card's current status in localStorage.

#### Scenario: Missing card (count = 0) detected

- GIVEN the detected card ID (e.g., "ESP_5") has count 0 in localStorage
- WHEN the scanner validates the code and looks up the status
- THEN the viewfinder frame SHALL display green (`#22c55e` or equivalent)
- AND the overlay SHALL show "Faltante" as the status

#### Scenario: Pasted card (count >= 1) detected

- GIVEN the detected card ID has count >= 1 in localStorage
- WHEN the scanner validates the code and looks up the status
- THEN the viewfinder frame SHALL display yellow/orange (`#f59e0b` or equivalent)
- AND the overlay SHALL show "Pegada" (count=1) or "X Repetida(s)" (count>1) as the status

### Requirement: Action Overlay

After a valid match, the system MUST display an overlay card with the detected code, current status, and action buttons.

#### Scenario: Overlay shows for missing card

- GIVEN scanner state is "frozen" and card is missing (count=0)
- WHEN the overlay renders
- THEN it SHALL display the detected code (e.g., "ESP 5")
- AND SHALL display status "Faltante"
- AND SHALL show a primary button labeled "Pegar"
- AND SHALL show a secondary button labeled "Siguiente"

#### Scenario: Overlay shows for existing card

- GIVEN scanner state is "frozen" and card has count=3
- WHEN the overlay renders
- THEN it SHALL display the detected code
- AND SHALL display status "3 Repetidas"
- AND SHALL show a primary button labeled "Agregar Repetida"
- AND SHALL show a secondary button labeled "Siguiente"

### Requirement: Pegar Action

The "Pegar" button MUST set the card count from 0 to 1 and persist immediately to localStorage.

#### Scenario: Pegar updates collection

- GIVEN the overlay is showing a missing card (count=0)
- WHEN the user taps "Pegar"
- THEN the system SHALL update the card count to 1 in localStorage
- AND SHALL show a brief success indicator
- AND SHALL remain in frozen state until the user taps "Siguiente"

### Requirement: Agregar Repetida Action

The "Agregar Repetida" button MUST increment the card count by 1 and persist immediately to localStorage.

#### Scenario: Agregar Repetida increments count

- GIVEN the overlay is showing a card with count=2
- WHEN the user taps "Agregar Repetida"
- THEN the system SHALL update the card count to 3 in localStorage
- AND SHALL update the overlay status to "3 Repetidas"
- AND SHALL remain in frozen state until the user taps "Siguiente"

### Requirement: Siguiente Action

The "Siguiente" button MUST reset the scanner state and resume the camera feed, regardless of whether a save action was performed.

#### Scenario: Siguiente resumes scanning

- GIVEN the scanner is in frozen state with overlay visible
- WHEN the user taps "Siguiente"
- THEN the system SHALL clear the scan result
- AND SHALL resume the video feed
- AND SHALL restart the auto-capture loop
- AND SHALL reset the viewfinder to default color

### Requirement: Lazy Loading

Tesseract.js MUST be loaded lazily — only when the user first navigates to the Intercambios tab.

#### Scenario: Tesseract loads on first visit

- GIVEN the app just loaded (no Tesseract in memory)
- WHEN the user navigates to Intercambios for the first time
- THEN the system SHALL dynamically import Tesseract.js
- AND SHALL initialize the Web Worker
- AND SHALL show a loading indicator until the OCR engine is ready
- AND SHALL NOT block the rest of the app

### Requirement: Navigation Integration

The Intercambios screen SHALL be accessible from the bottom navigation bar as a third tab.

#### Scenario: Tab appears in nav

- GIVEN the app is rendering the bottom navigation
- WHEN the user views the nav bar
- THEN there SHALL be a third tab labeled "Intercambios"
- AND tapping it SHALL switch to the scanner view

#### Scenario: Tab switching preserves state

- GIVEN the user is on the Intercambios screen with an active camera stream
- WHEN the user switches to another tab
- THEN the system SHALL release the camera stream (cleanup)
- AND SHALL reinitialize it when the user returns to Intercambios
