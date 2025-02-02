import './style.css';

const globalErrorElement = document.querySelector("#global-err-msg") as HTMLDivElement;

console.log("Checking bluetooth status...");

const availability = await navigator.bluetooth.getAvailability();
if (availability) {
	hideGlobalError();
	console.log("Bluetooth is available");
} else {
	showGlobalError("Bluetooth is not available on this browser. Please use Chrome or Edge instead.");
	throw new Error("Bluetooth is not available");
}

/* Some globals */
const NORDIC_UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NORDIC_UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // It's actually RX for the device
const NORDIC_UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // It's actually TX for the device

const connectControlButton = document.querySelector("#connect-control") as HTMLButtonElement;
const consoleOutputElement = document.querySelector("#console-output") as HTMLTextAreaElement;
const consoleInputElement = document.querySelector("#console-input-text") as HTMLInputElement;
const consoleSendButton = document.querySelector("#console-input-send") as HTMLButtonElement;

function hideGlobalError() {
	globalErrorElement.style.display = "none";
	globalErrorElement.innerText = "";
}

function showGlobalError(message: string) {
	globalErrorElement.innerText = message;
	globalErrorElement.style.display = "block";
}

function enableConsoleInputs() {
	consoleInputElement.disabled = false;
	consoleSendButton.disabled = false;
}

function disableConsoleInputs() {
	consoleInputElement.disabled = true;
	consoleSendButton.disabled = true;
}

function appendElementToConsoleOutput(text: string, isInput: boolean) {
	const element = document.createElement("div");
	if (isInput) {
		element.innerText = `> ${text}`;
		const classes = ["bg-gray-500", "text-white", "p-1", "w-full", "block"];
		element.classList.add(...classes);
	} else {
		element.innerText = text;
		element.classList.add("bg-gray-800", "text-white", "p-1", "w-full", "block");
	}

	consoleOutputElement.appendChild(element);
}

let bluetoothDeviceConnected = false;
let bluetoothDevice: BluetoothDevice | null = null;

disableConsoleInputs();

consoleSendButton.addEventListener("click", async () => {
	if (!bluetoothDeviceConnected) {
		console.error("Device not connected");
		return;
	}

	const text = consoleInputElement.value;
	console.log(`Sending: ${text}`);

	const service = await bluetoothDevice!!.gatt!!.getPrimaryService(NORDIC_UART_SERVICE);
	const txCharacteristic = await service.getCharacteristic(NORDIC_UART_TX);

	const textEncoder = new TextEncoder();
	const encoded = textEncoder.encode(text);
	await txCharacteristic.writeValue(encoded);
	console.log(`Sent: ${text}`);

	appendElementToConsoleOutput(text, true);

	consoleInputElement.value = "";
});

async function onConnectControlBtnWantsToDisconnect() {
	if (bluetoothDevice) {
		bluetoothDevice.gatt!!.disconnect();
		console.log(`Disconnected from device ${bluetoothDevice.name}`);
	}

	bluetoothDeviceConnected = false;
	bluetoothDevice = null;
	connectControlButton.innerText = "Connect";
}

function onGattDisconnected() {
	console.log("Device disconnected");

	bluetoothDeviceConnected = false;
	disableConsoleInputs();
}

async function onConnectControlBtnWantsToConnect() {
	bluetoothDevice = await navigator.bluetooth.requestDevice({
		filters: [
			{ services: [NORDIC_UART_SERVICE] }
		]
	});

	if (!bluetoothDevice.gatt) {
		throw new Error("Device does not support GATT");
	}

	try {
		const server = await bluetoothDevice.gatt.connect();
		server.device.addEventListener("gattserverdisconnected", onGattDisconnected);
		console.log(`Connected to device ${bluetoothDevice.name}`);
		connectControlButton.innerText = "Disconnect";
		bluetoothDeviceConnected = true;

		const service = await server.getPrimaryService(NORDIC_UART_SERVICE);
		const rxCharacteristic = await service.getCharacteristic(NORDIC_UART_RX);

		const textDecoder = new TextDecoder();

		rxCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
			const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
			const text = textDecoder.decode(value!);
			console.log(`Received: ${text}`);

			if (text.trim().length === 0) {
				return;
			}

			appendElementToConsoleOutput(text, false);
			consoleOutputElement.scrollTop = consoleOutputElement.scrollHeight;
		});

		await rxCharacteristic.startNotifications();

		enableConsoleInputs();
	} catch (ex) {
		console.error("Error connecting to device", ex);
		bluetoothDeviceConnected = false;
	}
}

connectControlButton.addEventListener("click", async () => {
	if (bluetoothDeviceConnected) {
		console.log("Disconnecting from device");
		await onConnectControlBtnWantsToDisconnect();
	} else {
		console.log("Connecting to device");
		await onConnectControlBtnWantsToConnect();
	}
});


export { };
