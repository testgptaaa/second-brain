export async function request<T = any>(
  type: string,
  payload: any = {},
): Promise<T> {
  if (!window.secondBrain)
    throw new Error("Ядро недоступно. Запустите приложение через npm start.");
  const result = await window.secondBrain.sendRequest<any>(type, payload);
  if (result?.success === false)
    throw new Error("Конфликт: изменения не сохранены. Перечитайте документ.");
  return result;
}
