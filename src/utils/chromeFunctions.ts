const createRandomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export const notify = (title: string, message: string) => {
  chrome.notifications.create(createRandomId(), {
    type: "basic",
    title: title,
    message: message,
    iconUrl: "icons/icon.png",
  });
};

export const createAlarm = (
  hash: string,
  dateInMilliseconds: number,
  periodInMinutes = 5
) => {
  console.table({
    hash,
    dateInMilliseconds,
    periodInMinutes,
    "Creating alarm": "true",
  });

  chrome.alarms.create(hash, {
    when: dateInMilliseconds,
    periodInMinutes: periodInMinutes,
  });
};

export const clearAlarm = (hash: string) => {
  chrome.alarms.clear(hash, function (wasCleared) {
    console.log(`Alarm ${hash} was cleared: ${wasCleared}`);
  });
};

export const clearAllAlarms = () => {
  chrome.alarms.clearAll();
};
