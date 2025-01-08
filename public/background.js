const createRandomId = () => {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    );
};

const notify = (title, message) => {
    chrome.notifications.create(createRandomId(), {
        title: title,
        message: message,
        iconUrl: "icons/icon.png",
        type: "basic",
    });
};

const retrieveFromLs = (key, callback) => {
    chrome.storage.local.get(key, (result) => {
        callback(result[key]);
    });
};

chrome.alarms.onAlarm.addListener(function (alarm) {
    const notifyMessage = (tasks) => {
        // Get the task with the id of the alarm
        if (alarm.name.includes("-endOfTask")) {
            const taskId = alarm.name.split("-endOfTask")[0];
            const task = tasks.find((task) => task.id === taskId);

            chrome.notifications.create(createRandomId(), {
                title: String(task.title),
                message: "Task should be completed now!",
                iconUrl: "icons/icon.png",
                type: "basic",
            });

            chrome.alarms.clear(task.id);
            chrome.alarms.clear(task.id + "-endOfTask");
            console.log("Alarms for task", task.id, "cleared successfully!");
            return;
        }

        const task = tasks.find((task) => task.id === alarm.name);

        const alarmInfo = task;


        if (!alarmInfo) {
            console.log("No alarmInfo for alarm", alarm.name);
            return;
        }

        chrome.notifications.create(createRandomId(), {
            title: String(alarmInfo.title),
            message: String(alarmInfo.reminderText),
            iconUrl: "icons/icon.png",
            type: "basic",
        });
    }
    retrieveFromLs("tasks", notifyMessage);
});


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "mi-opcion",
        title: "Haz algo interesante",
        contexts: ["all"], // Contextos: "page", "selection", "link", etc.
    });
});


function pegarHelloWorld() {
    console.log("Ejecutando pegarHelloWorld");
    const activeElement = document.activeElement;
    console.log(activeElement, "activeElement");
    if (activeElement && (activeElement.isContentEditable || /^(INPUT|TEXTAREA)$/.test(activeElement.tagName))) {
        activeElement.value
            ? (activeElement.value += "Hello World") // Para inputs y textareas
            : (activeElement.innerHTML += "Hello World"); // Para contenteditables
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "mi-opcion") {
        console.log(info);
        console.log(tab);
        console.log("Se agregara tu mensaje al elemento seleccionado");

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: pegarHelloWorld
        });

    }
});
