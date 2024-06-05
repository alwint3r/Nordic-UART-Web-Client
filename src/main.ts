import './style.css';

console.log("Checking bluetooth status...");

const availability = await navigator.bluetooth.getAvailability();
if (availability) {
	console.log("Bluetooth is available");
} else {
	throw new Error("Bluetooth is not available");
}

/* Some globals */
const NORDIC_UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NORDIC_UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // It's actually RX for the device
const NORDIC_UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // It's actually TX for the device

const connectControlButton = document.querySelector("#connect-control") as HTMLButtonElement;
const consoleDisplayElement = document.querySelector("#console-display") as HTMLDivElement;
const consoleOutputElement = document.querySelector("#console-output") as HTMLTextAreaElement;
const consoleInputElement = document.querySelector("#console-input-text") as HTMLInputElement;
const consoleSendButton = document.querySelector("#console-input-send") as HTMLButtonElement;

let bluetoothDeviceConnected = false;
let bluetoothDevice: BluetoothDevice | null = null;

// hide console display element by default
consoleDisplayElement.style.display = "none";

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

			consoleOutputElement.innerHTML += text + "\n";
			consoleOutputElement.scrollTop = consoleOutputElement.scrollHeight;
		});

		await rxCharacteristic.startNotifications();

		consoleDisplayElement.style.display = "block";
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
