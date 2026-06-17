export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  let expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  let decodedCookie = "";
  try {
    decodedCookie = decodeURIComponent(document.cookie);
  } catch (e) {
    decodedCookie = document.cookie;
  }
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name + "=") == 0) {
      return c.substring(name.length + 1, c.length);
    }
  }
  return null;
}

export function eraseCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}
